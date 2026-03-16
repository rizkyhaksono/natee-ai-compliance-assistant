from pydantic import BaseModel
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    action: str
    query: Optional[str] = None
    response: Optional[str] = None
    source_chunks: Optional[List[Any]] = None
    model_used: Optional[str] = None
    confidence_score: Optional[float] = None
    judgment_mode: Optional[str] = None
    guardrail_flags: Optional[List[str]] = None
    reviewer_feedback: Optional[str] = None
    reviewer_score: Optional[float] = None
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewFeedbackRequest(BaseModel):
    feedback: str
    score: float  # 1-5
    reviewer_id: UUID
