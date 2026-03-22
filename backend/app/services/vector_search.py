import logging
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.chunk import Chunk
from app.models.document import Document, DocumentStatus

logger = logging.getLogger(__name__)


class VectorSearchService:
    """Performs similarity search using pgvector."""

    @staticmethod
    async def search(
        db: AsyncSession,
        query_embedding: List[float],
        top_k: int = 10,
        document_ids: Optional[List[UUID]] = None,
        threshold: float = 0.3,
    ) -> List[dict]:
        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

        query = text("""
            SELECT
                c.id as chunk_id,
                c.document_id,
                c.content,
                c.section,
                c.page_number,
                c.chunk_index,
                d.name as document_name,
                d.document_type,
                1 - (c.embedding <=> CAST(:embedding AS vector)) as relevance_score
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE d.status::text = :status
            AND 1 - (c.embedding <=> CAST(:embedding AS vector)) > :threshold
        """)

        params = {"embedding": embedding_str, "status": DocumentStatus.READY.name, "threshold": threshold}

        if document_ids:
            doc_ids_str = ",".join(f"'{str(did)}'" for did in document_ids)
            query = text(f"""
                SELECT
                    c.id as chunk_id,
                    c.document_id,
                    c.content,
                    c.section,
                    c.page_number,
                    c.chunk_index,
                    d.name as document_name,
                    d.document_type,
                    1 - (c.embedding <=> CAST(:embedding AS vector)) as relevance_score
                FROM chunks c
                JOIN documents d ON c.document_id = d.id
                WHERE d.status::text = :status
                AND c.document_id IN ({doc_ids_str})
                AND 1 - (c.embedding <=> CAST(:embedding AS vector)) > :threshold
                ORDER BY c.embedding <=> CAST(:embedding AS vector)
                LIMIT :top_k
            """)
        else:
            query = text("""
                SELECT
                    c.id as chunk_id,
                    c.document_id,
                    c.content,
                    c.section,
                    c.page_number,
                    c.chunk_index,
                    d.name as document_name,
                    d.document_type,
                    1 - (c.embedding <=> CAST(:embedding AS vector)) as relevance_score
                FROM chunks c
                JOIN documents d ON c.document_id = d.id
                WHERE d.status::text = :status
                AND 1 - (c.embedding <=> CAST(:embedding AS vector)) > :threshold
                ORDER BY c.embedding <=> CAST(:embedding AS vector)
                LIMIT :top_k
            """)

        params["top_k"] = top_k
        result = await db.execute(query, params)
        rows = result.fetchall()

        logger.info(
            "VectorSearch: doc_filter=%s threshold=%s top_k=%s → %d rows",
            [str(d) for d in (document_ids or [])],
            params.get("threshold"),
            top_k,
            len(rows),
        )

        return [
            {
                "chunk_id": row.chunk_id,
                "document_id": row.document_id,
                "content": row.content,
                "section": row.section,
                "page_number": row.page_number,
                "chunk_index": row.chunk_index,
                "document_name": row.document_name,
                "document_type": row.document_type,
                "relevance_score": float(row.relevance_score),
            }
            for row in rows
        ]
