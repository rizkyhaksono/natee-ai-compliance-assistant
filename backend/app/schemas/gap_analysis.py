from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from enum import Enum


class RiskLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    COMPLIANT = "compliant"


class GapAnalysisRequest(BaseModel):
    regulation_document_id: UUID
    internal_document_id: UUID
    judgment_mode: Optional[str] = None


class GapItem(BaseModel):
    regulation_clause: str
    regulation_text: str
    internal_reference: Optional[str] = None
    internal_text: Optional[str] = None
    status: str  # "compliant", "partial", "non_compliant", "not_found"
    risk_level: RiskLevel
    gap_description: str
    recommended_action: str


class GapAnalysisResponse(BaseModel):
    regulation_document: str
    internal_document: str
    total_items: int
    compliant_count: int
    partial_count: int
    non_compliant_count: int
    not_found_count: int
    overall_risk: RiskLevel
    gaps: List[GapItem]
    summary: str
    audit_log_id: UUID
