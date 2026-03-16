import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Float, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    audit_log_id = Column(UUID(as_uuid=True), nullable=True)
    eval_type = Column(String(100), nullable=False)  # retrieval_relevance, faithfulness, etc.
    query = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=True)
    actual_answer = Column(Text, nullable=True)
    retrieved_chunks = Column(JSON, nullable=True)
    score = Column(Float, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
