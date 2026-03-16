import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.config import get_settings, Settings

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
