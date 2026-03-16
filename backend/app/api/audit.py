import uuid
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.audit import AuditLogResponse, ReviewFeedbackRequest
from app.services.audit import AuditService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/", response_model=List[AuditLogResponse])
async def get_audit_logs(
    action: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """Get audit logs with optional filtering."""
    logs = await AuditService.get_logs(db, action=action, limit=limit, offset=offset)
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.get("/{audit_log_id}", response_model=AuditLogResponse)
async def get_audit_log(audit_log_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    from app.models.audit_log import AuditLog
    log = await db.get(AuditLog, audit_log_id)
    if not log:
        raise HTTPException(404, "Audit log not found")
    return AuditLogResponse.model_validate(log)


@router.post("/{audit_log_id}/feedback", response_model=AuditLogResponse)
async def add_review_feedback(
    audit_log_id: uuid.UUID,
    request: ReviewFeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """Add reviewer feedback to an audit log entry."""
    try:
        log = await AuditService.add_feedback(
            db, audit_log_id=audit_log_id,
            feedback=request.feedback,
            score=request.score,
            reviewer_id=request.reviewer_id,
        )
        return AuditLogResponse.model_validate(log)
    except ValueError as e:
        raise HTTPException(404, str(e))
