import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    action = Column(String(100), nullable=False)  # e.g., "qa_query", "gap_analysis", "checklist"
    query = Column(Text, nullable=True)
    response = Column(Text, nullable=True)
    source_chunks = Column(JSON, nullable=True)  # list of chunk IDs used
    model_used = Column(String(100), nullable=True)
    confidence_score = Column(Float, nullable=True)
    judgment_mode = Column(String(50), nullable=True)
    guardrail_flags = Column(JSON, nullable=True)
    reviewer_feedback = Column(Text, nullable=True)
    reviewer_score = Column(Float, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
