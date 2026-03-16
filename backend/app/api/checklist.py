import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.checklist import ChecklistRequest, ChecklistResponse
from app.services.checklist import ChecklistService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/checklist", tags=["checklist"])


@router.post("/", response_model=ChecklistResponse)
async def generate_checklist(
    request: ChecklistRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate compliance checklist from a regulation document."""
    service = ChecklistService()
    try:
        return await service.generate(
            db=db,
            document_id=request.document_id,
            focus_area=request.focus_area,
            judgment_mode=request.judgment_mode,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Checklist error: {e}")
        raise HTTPException(500, f"Error generating checklist: {str(e)}")
