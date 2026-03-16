from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from enum import Enum


class DocumentTypeEnum(str, Enum):
    REGULATION = "regulation"
    SOP = "sop"
    CONTRACT = "contract"
    POLICY = "policy"
    OTHER = "other"


class DocumentUploadResponse(BaseModel):
    id: UUID
    name: str
    original_filename: str
    document_type: DocumentTypeEnum
    status: str
    file_size: int
    total_chunks: int
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentListItem(BaseModel):
    id: UUID
    name: str
    document_type: DocumentTypeEnum
    status: str
    version: Optional[str] = None
    division: Optional[str] = None
    total_chunks: int
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentDetail(DocumentListItem):
    original_filename: str
    file_size: int
    mime_type: Optional[str] = None
    effective_date: Optional[datetime] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentUploadRequest(BaseModel):
    name: Optional[str] = None
    document_type: DocumentTypeEnum = DocumentTypeEnum.OTHER
    version: Optional[str] = "1.0"
    effective_date: Optional[datetime] = None
    division: Optional[str] = None
    description: Optional[str] = None
