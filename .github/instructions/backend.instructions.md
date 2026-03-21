---
name: backend-development
description: "Use when: working on Python FastAPI backend, creating API endpoints, database models, services, or implementing RAG/LLM features. Enforces type safety, audit logging, error handling patterns."
applyTo: "backend/**/*.py"
---

# Backend Development Guidelines

## Stack
- **Framework**: FastAPI
- **Database**: PostgreSQL with SQLAlchemy ORM
- **LLM**: Ollama (qwen3.5:2b)
- **Embeddings**: all-minilm-L6-v2
- **Language**: Python 3.9+

## Architecture Patterns

### 1. API Endpoints (app/api/)
- One file per feature/resource
- Use dependency injection for services
- Return Pydantic schemas (not raw models)
- Include comprehensive docstrings

```python
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas.document import DocumentResponse
from app.services.document_parser import DocumentParserService
from app.models.audit_log import audit_log

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    service: DocumentParserService = Depends(),
) -> DocumentResponse:
    """Upload and parse a compliance document.
    
    Args:
        file: Document file (PDF, DOCX, TXT)
        current_user: Authenticated user
        service: Document parser service
        
    Returns:
        DocumentResponse with parsed document metadata
        
    Raises:
        HTTPException: If file is invalid or too large
    """
    try:
        # Validate
        if file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File exceeds size limit")
        
        # Process
        doc = await service.parse_and_store(file, current_user.id)
        
        # Audit log
        await audit_log(
            user_id=current_user.id,
            action="document:upload",
            resource_id=doc.id,
            details={"filename": doc.filename, "size": doc.size}
        )
        
        return doc
    except ValueError as e:
        logger.error(f"Validation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
```

### 2. Services (app/services/)
- Business logic layer with dependency injection
- Async/await for all I/O operations
- Mock-friendly for testing

```python
from typing import List
from app.models.document import Document
from app.services.embedding import EmbeddingService

class DocumentParserService:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        db: AsyncSession = Depends(get_db)
    ):
        self.embedding = embedding_service
        self.db = db
    
    async def parse_and_store(self, file: UploadFile, user_id: int) -> Document:
        """Parse document, chunk, and generate embeddings."""
        # 1. Extract content
        content = await self._extract_text(file)
        
        # 2. Chunk content (512 chars with 10% overlap)
        chunks = self._chunk_text(content, chunk_size=512, overlap=52)
        
        # 3. Generate embeddings for each chunk
        embeddings = []
        for chunk in chunks:
            emb = await self.embedding.embed(chunk)
            embeddings.append(emb)
        
        # 4. Store in database
        doc = Document(
            filename=file.filename,
            content=content,
            user_id=user_id,
            chunks=[
                Chunk(content=c, embedding=e)
                for c, e in zip(chunks, embeddings)
            ]
        )
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)
        
        return doc
```

### 3. Models (app/models/)
- SQLAlchemy ORM with type hints
- Include timestamps (created_at, updated_at)
- Add database indexes for search fields

```python
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Document(Base):
    __tablename__ = "documents"
    
    id: int = Column(Integer, primary_key=True, index=True)
    filename: str = Column(String(255), nullable=False)
    content: str = Column(Text, nullable=False)
    user_id: int = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: datetime = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at: datetime = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_user_created", "user_id", "created_at"),
    )
```

### 4. Schemas (app/schemas/)
- Pydantic V2 for validation
- Separate request (Input) and response (Output) schemas
- Include examples for API documentation

```python
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import List, Optional

class DocumentCreate(BaseModel):
    """Document upload request."""
    # File is handled by FastAPI UploadFile, not here
    pass

class ChunkResponse(BaseModel):
    """Chunk of a document."""
    id: int
    content: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    
    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    """Document with metadata."""
    id: int
    filename: str
    created_at: datetime
    chunk_count: int = Field(..., alias="chunks_count")
    chunks: Optional[List[ChunkResponse]] = None
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "filename": "compliance-report.pdf",
                "created_at": "2025-03-22T10:30:00Z",
                "chunk_count": 25,
            }
        }
```

### 5. RAG Pipeline (services/rag.py)
- Retrieve relevant chunks from vector DB
- Include context guardrails
- Use confidence threshold filtering

```python
from app.services.llm import LLMService
from app.services.vector_search import VectorSearchService

class RAGService:
    def __init__(
        self,
        vector_search: VectorSearchService,
        llm: LLMService
    ):
        self.vector_search = vector_search
        self.llm = llm
    
    async def answer_question(
        self,
        question: str,
        user_id: int,
        top_k: int = 10
    ) -> dict:
        """Answer question using RAG.
        
        Args:
            question: User question
            user_id: ID of requesting user
            top_k: Number of chunks to retrieve
            
        Returns:
            {
                "answer": str,
                "sources": List[DocumentChunk],
                "confidence": float
            }
        """
        # Retrieve relevant chunks
        chunks = await self.vector_search.search(
            query=question,
            user_id=user_id,
            top_k=min(top_k, MAX_CONTEXT_CHUNKS),
            threshold=CONFIDENCE_THRESHOLD
        )
        
        # Format context
        context = "\n---\n".join([
            f"[{i+1}] {chunk.document.filename}\n{chunk.content}"
            for i, chunk in enumerate(chunks)
        ])
        
        # Generate answer
        response = await self.llm.generate(
            system_prompt=get_system_prompt("qa"),
            user_query=question,
            context=context,
            judgment_mode=JUDGMENT_MODE
        )
        
        return {
            "answer": response["text"],
            "sources": [{"id": c.id, "filename": c.document.filename} for c in chunks],
            "confidence": response.get("confidence", 0.5)
        }
```

## Code Standards

### Type Hints
- Always use type hints (PEP 484)
- Use `Optional[T]` for nullable values
- Use `List[T]`, `Dict[K, V]` instead of lowercase

```python
# Good
async def process_chunks(chunks: List[str], batch_size: int = 10) -> List[np.ndarray]:
    pass

# Bad
async def process_chunks(chunks, batch_size=10):
    pass
```

### Async/Await
- Use async for all database operations
- Use async for all API calls (embedding, LLM)
- Never block the event loop

```python
# Good
async def get_document(doc_id: int, db: AsyncSession) -> Document:
    result = await db.execute(select(Document).where(Document.id == doc_id))
    return result.scalar_one_or_none()

# Bad
def get_document(doc_id: int, db: AsyncSession) -> Document:  # Sync def with async ops
    result = db.execute(select(Document).where(Document.id == doc_id))
    return result.scalar_one_or_none()
```

### Error Handling
- Always catch and log errors
- Return appropriate HTTP status codes
- Never expose internal details in error messages

```python
# Good
try:
    doc = await service.parse_document(file)
except ValueError as e:
    logger.error(f"Invalid document format: {str(e)}")
    raise HTTPException(status_code=400, detail="Invalid file format")
except Exception as e:
    logger.error(f"Unexpected error: {str(e)}", exc_info=True)
    raise HTTPException(status_code=500, detail="Internal server error")
```

### Audit Logging
- Log ALL user actions affecting data
- Include user_id, action, resource_id, timestamp
- Never modify audit logs

```python
await audit_log(
    user_id=current_user.id,
    action="document:analysis",
    resource_id=document.id,
    details={
        "analysis_type": "gap_analysis",
        "result_count": 15,
        "confidence": 0.87
    },
    ip_address=request.client.host
)
```

## Testing

### Unit Tests
- Mock external services (LLM, embeddings)
- Test each layer independently
- Use pytest fixtures

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_document_parser():
    # Arrange
    mock_embedding = AsyncMock()
    mock_embedding.embed.return_value = np.random.rand(384)
    service = DocumentParserService(embedding_service=mock_embedding)
    
    # Act
    doc = await service.parse_and_store(test_file, user_id=1)
    
    # Assert
    assert doc.id is not None
    assert len(doc.chunks) > 0
    mock_embedding.embed.assert_called()
```

### Integration Tests
- Test full API flow
- Use test database with migrations
- Clean up after each test

## Key Environment Variables

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=db_compliance_assistant
POSTGRES_USER=root
POSTGRES_PASSWORD=rootiniboss123

# LLM
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://172.29.176.1:11434
OLLAMA_MODEL=qwen3.5:2b

# Embeddings
EMBEDDING_MODEL=all-minilm

# Compliance
MAX_CONTEXT_CHUNKS=10
CONFIDENCE_THRESHOLD=0.5
JUDGMENT_MODE=moderate
MAX_UPLOAD_SIZE_MB=50
UPLOAD_DIR=/app/uploads
```

## Useful Commands

```bash
cd backend

# Run development server
make start

# Run tests
make test

# Run linting/formatting
make lint
black .
isort .
mypy .

# Database migrations
alembic revision --autogenerate -m "Add user table"
alembic upgrade head
```

## Common Patterns

### Database Query
```python
from sqlalchemy import select

async def get_user_documents(user_id: int, db: AsyncSession) -> List[Document]:
    result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()
```

### API Response
```python
from fastapi.responses import JSONResponse

@router.get("/status")
async def health_check():
    return JSONResponse(
        status_code=200,
        content={"status": "healthy", "version": "1.0.0"}
    )
```

### Service Dependency
```python
def get_rag_service(db: AsyncSession = Depends(get_db)) -> RAGService:
    vector_search = VectorSearchService(db)
    llm = LLMService()
    return RAGService(vector_search, llm)

@router.post("/answer")
async def ask_question(
    query: str,
    service: RAGService = Depends(get_rag_service)
):
    return await service.answer_question(query)
```

## When Stuck

1. **Database issues** → Check `app/models/` and `alembic/versions/`
2. **API design** → Look at existing endpoints in `app/api/`
3. **LLM/RAG** → Check `services/rag.py` and `prompts/`
4. **Audit logging** → Check `services/audit.py`
5. **Type errors** → Run `mypy .` to catch issues early
