import uuid
import logging
from typing import Optional, List, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    """Manages audit trail for all AI interactions."""

    @staticmethod
    async def log(
        db: AsyncSession,
        user_id: Optional[uuid.UUID] = None,
        action: str = "",
        query: Optional[str] = None,
        response: Optional[str] = None,
        source_chunks: Optional[List[str]] = None,
        model_used: Optional[str] = None,
        confidence_score: Optional[float] = None,
        judgment_mode: Optional[str] = None,
        guardrail_flags: Optional[List[str]] = None,
        metadata: Optional[dict] = None,
    ) -> uuid.UUID:
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            query=query,
            response=response,
            source_chunks=source_chunks,
            model_used=model_used,
            confidence_score=confidence_score,
            judgment_mode=judgment_mode,
            guardrail_flags=guardrail_flags,
            metadata_=metadata,
        )
        db.add(audit_log)
        await db.commit()
        await db.refresh(audit_log)
        return audit_log.id

    @staticmethod
    async def get_logs(
        db: AsyncSession,
        action: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AuditLog]:
        query = select(AuditLog).order_by(desc(AuditLog.created_at))
        if action:
            query = query.where(AuditLog.action == action)
        if user_id:
            query = query.where(AuditLog.user_id == user_id)
        query = query.limit(limit).offset(offset)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def add_feedback(
        db: AsyncSession,
        audit_log_id: uuid.UUID,
        feedback: str,
        score: float,
        reviewer_id: uuid.UUID,
    ) -> AuditLog:
        audit_log = await db.get(AuditLog, audit_log_id)
        if not audit_log:
            raise ValueError("Audit log not found")
        audit_log.reviewer_feedback = feedback
        audit_log.reviewer_score = score
        audit_log.reviewed_by = reviewer_id
        audit_log.reviewed_at = datetime.utcnow()
        await db.commit()
        await db.refresh(audit_log)
        return audit_log
