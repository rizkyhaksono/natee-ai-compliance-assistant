from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    document_ids: Optional[List[UUID]] = None
    judgment_mode: Optional[str] = None  # conservative, moderate, lenient


class SourceChunk(BaseModel):
    chunk_id: UUID
    document_id: UUID
    document_name: str
    document_type: str
    section: Optional[str] = None
    page_number: Optional[int] = None
    content: str
    relevance_score: float


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceChunk]
    confidence: float
    guardrail_flags: List[str] = []
    audit_log_id: UUID
