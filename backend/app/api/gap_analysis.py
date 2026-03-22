import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.gap_analysis import GapAnalysisRequest, GapAnalysisResponse
from app.services.gap_analysis import GapAnalysisService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/gap-analysis", tags=["gap-analysis"])


@router.post("", response_model=GapAnalysisResponse)
async def run_gap_analysis(
    request: GapAnalysisRequest,
    db: AsyncSession = Depends(get_db),
):
    """Compare regulation against internal document to find compliance gaps."""
    service = GapAnalysisService()
    try:
        return await service.analyze(
            db=db,
            regulation_doc_id=request.regulation_document_id,
            internal_doc_id=request.internal_document_id,
            judgment_mode=request.judgment_mode,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Gap analysis error: {e}")
        raise HTTPException(500, f"Error running gap analysis: {str(e)}")
