import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Integer, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class DocumentType(str, enum.Enum):
    REGULATION = "regulation"
    SOP = "sop"
    CONTRACT = "contract"
    POLICY = "policy"
    OTHER = "other"


class DocumentStatus(str, enum.Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    document_type = Column(SAEnum(DocumentType), nullable=False, default=DocumentType.OTHER)
    status = Column(SAEnum(DocumentStatus), nullable=False, default=DocumentStatus.UPLOADING)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100))
    version = Column(String(50), default="1.0")
    effective_date = Column(DateTime, nullable=True)
    division = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    total_chunks = Column(Integer, default=0)
    uploaded_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
