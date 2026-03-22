import os
import uuid
import logging
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.config import get_settings
from app.models.document import Document, DocumentType, DocumentStatus
from app.models.chunk import Chunk
from app.schemas.document import (
    DocumentUploadResponse, DocumentListItem, DocumentDetail, DocumentTypeEnum,
)
from app.services.document_parser import DocumentParser
from app.services.chunking import ChunkingService
from app.services.embedding import EmbeddingService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    document_type: str = Form("other"),
    version: str = Form("1.0"),
    division: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    # Validate file type
    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}. Allowed: PDF, DOCX, TXT")

    # Read file
    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(400, f"File too large. Max: {settings.max_upload_size_mb}MB")

    # Save file
    doc_id = uuid.uuid4()
    file_ext = os.path.splitext(file.filename)[1]
    file_path = os.path.join(settings.upload_dir, f"{doc_id}{file_ext}")
    os.makedirs(settings.upload_dir, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(content)

    # Create document record
    doc = Document(
        id=doc_id,
        name=name or file.filename,
        original_filename=file.filename,
        document_type=DocumentType(document_type),
        status=DocumentStatus.PROCESSING,
        file_path=file_path,
        file_size=len(content),
        mime_type=file.content_type,
        version=version,
        division=division,
        description=description,
    )
    db.add(doc)
    await db.commit()

    # Process document: parse → chunk → embed → store
    try:
        text_content = await DocumentParser.parse(content, file.content_type)
        chunking_service = ChunkingService()
        chunk_metas = chunking_service.chunk_text(text_content)

        if not chunk_metas:
            raise ValueError("No text could be extracted from document")

        # Generate and store embeddings chunk-by-chunk so one bad chunk does not fail the whole upload.
        stored_chunks = 0
        for cm in chunk_metas:
            try:
                embedding = EmbeddingService.embed_query(cm.content)
            except Exception as embedding_error:
                logger.warning(
                    "Skipping chunk embedding for document %s at chunk %s: %s",
                    str(doc_id),
                    cm.chunk_index,
                    str(embedding_error),
                )
                continue

            chunk = Chunk(
                document_id=doc_id,
                content=cm.content,
                chunk_index=cm.chunk_index,
                section=cm.section,
                page_number=cm.page_number,
                embedding=embedding,
            )
            db.add(chunk)
            stored_chunks += 1

        if stored_chunks == 0:
            raise ValueError("No valid chunk embeddings could be generated")

        doc.status = DocumentStatus.READY
        doc.total_chunks = stored_chunks
        await db.commit()
        await db.refresh(doc)

        logger.info(f"Document processed: {doc.name} ({stored_chunks}/{len(chunk_metas)} chunks)")

    except Exception as e:
        logger.error(f"Error processing document: {e}")
        doc.status = DocumentStatus.ERROR
        await db.commit()
        raise HTTPException(500, f"Error processing document: {str(e)}")

    return DocumentUploadResponse(
        id=doc.id,
        name=doc.name,
        original_filename=doc.original_filename,
        document_type=DocumentTypeEnum(doc.document_type.value),
        status=doc.status.value,
        file_size=doc.file_size,
        total_chunks=doc.total_chunks,
        created_at=doc.created_at,
    )


@router.get("")
async def list_documents(
    document_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    from app.schemas.pagination import PaginatedResponse

    base_query = select(Document)
    if document_type:
        base_query = base_query.where(Document.document_type == DocumentType(document_type))

    # Count total
    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar() or 0

    # Fetch paginated results
    query = base_query.order_by(Document.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    docs = result.scalars().all()

    items = [
        DocumentListItem(
            id=d.id, name=d.name,
            document_type=DocumentTypeEnum(d.document_type.value),
            status=d.status.value, version=d.version,
            division=d.division, total_chunks=d.total_chunks,
            created_at=d.created_at,
        )
        for d in docs
    ]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{document_id}", response_model=DocumentDetail)
async def get_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return DocumentDetail(
        id=doc.id, name=doc.name,
        document_type=DocumentTypeEnum(doc.document_type.value),
        status=doc.status.value, version=doc.version,
        division=doc.division, total_chunks=doc.total_chunks,
        created_at=doc.created_at, original_filename=doc.original_filename,
        file_size=doc.file_size, mime_type=doc.mime_type,
        effective_date=doc.effective_date, description=doc.description,
    )


@router.delete("/{document_id}")
async def delete_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    # Remove file
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    await db.delete(doc)
    await db.commit()
    return {"status": "deleted", "id": str(document_id)}


@router.get("/{document_id}/download")
async def download_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Download the original uploaded file."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(
        path=doc.file_path,
        filename=doc.original_filename,
        media_type=doc.mime_type or "application/octet-stream",
    )


@router.get("/{document_id}/content")
async def get_document_content(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get extracted text content from document chunks."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    result = await db.execute(
        select(Chunk).where(Chunk.document_id == document_id).order_by(Chunk.chunk_index)
    )
    chunks = result.scalars().all()

    return {
        "document_id": str(document_id),
        "document_name": doc.name,
        "total_chunks": len(chunks),
        "content": [
            {
                "chunk_index": c.chunk_index,
                "section": c.section,
                "page_number": c.page_number,
                "content": c.content,
            }
            for c in chunks
        ],
    }
