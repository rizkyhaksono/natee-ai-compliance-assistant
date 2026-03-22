import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.config import get_settings, Settings
from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


class GuardrailsConfig(BaseModel):
    judgment_mode: str  # conservative, moderate, lenient
    max_context_chunks: int
    confidence_threshold: float


class AdminConfigResponse(BaseModel):
    judgment_mode: str
    max_context_chunks: int
    confidence_threshold: float
    llm_provider: str
    llm_model: str
    ollama_model: str
    embedding_model: str


@router.get("/config", response_model=AdminConfigResponse)
async def get_config():
    """Get current system configuration."""
    settings = get_settings()
    return AdminConfigResponse(
        judgment_mode=settings.judgment_mode,
        max_context_chunks=settings.max_context_chunks,
        confidence_threshold=settings.confidence_threshold,
        llm_provider=settings.llm_provider,
        llm_model=settings.active_llm_model,
        ollama_model=settings.ollama_model,
        embedding_model=settings.embedding_model,
    )


# In-memory runtime config overrides (per-session, resets on restart)
_runtime_config = {}


@router.put("/config")
async def update_config(config: GuardrailsConfig):
    """Update runtime configuration (does not persist across restarts)."""
    _runtime_config["judgment_mode"] = config.judgment_mode
    _runtime_config["max_context_chunks"] = config.max_context_chunks
    _runtime_config["confidence_threshold"] = config.confidence_threshold
    return {"status": "updated", "config": config.model_dump()}


@router.get("/runtime-config")
async def get_runtime_config():
    """Get runtime overrides."""
    return _runtime_config


@router.get("/debug/chunks")
async def debug_chunks(db: AsyncSession = Depends(get_db)):
    """Debug: check chunks table state."""
    result = await db.execute(text("""
        SELECT
            d.id::text as doc_id,
            d.name,
            d.status::text as status,
            COUNT(c.id) as total_chunks,
            COUNT(c.embedding) as chunks_with_embedding,
            COUNT(c.id) - COUNT(c.embedding) as chunks_null_embedding
        FROM documents d
        LEFT JOIN chunks c ON c.document_id = d.id
        GROUP BY d.id, d.name, d.status
    """))
    rows = result.fetchall()
    return {
        "documents": [
            {
                "doc_id": r.doc_id,
                "name": r.name,
                "status": r.status,
                "total_chunks": r.total_chunks,
                "chunks_with_embedding": r.chunks_with_embedding,
                "chunks_null_embedding": r.chunks_null_embedding,
            }
            for r in rows
        ]
    }
