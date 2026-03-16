from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from enum import Enum


class Priority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ChecklistRequest(BaseModel):
    document_id: UUID
    focus_area: Optional[str] = None
    judgment_mode: Optional[str] = None


class ChecklistItem(BaseModel):
    item_number: int
    requirement: str
    source_clause: str
    priority: Priority
    action_needed: str
    responsible_party: Optional[str] = None
    deadline_suggestion: Optional[str] = None
    notes: Optional[str] = None


class ChecklistResponse(BaseModel):
    document_name: str
    focus_area: Optional[str] = None
    total_items: int
    items: List[ChecklistItem]
    summary: str
    audit_log_id: UUID
