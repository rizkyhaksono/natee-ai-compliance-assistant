import logging
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.database import get_db, async_session
from app.schemas.evaluation import EvaluationRunRequest, EvaluationSummary, EvaluationResult
from app.services.evaluation import EvaluationService
from app.models.evaluation import Evaluation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


async def _run_eval_background(
    test_queries: Optional[List[str]],
    document_ids: Optional[List[UUID]],
):
    """Background task: run evaluation suite and persist results."""
    async with async_session() as db:
        try:
            service = EvaluationService()
            await service.run_evaluation_suite(
                db, test_queries=test_queries, document_ids=document_ids
            )
        except Exception as e:
            logger.error(f"Background evaluation error: {e}")


@router.post("/run", status_code=202)
async def run_evaluation(
    request: EvaluationRunRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Clear previous results and trigger evaluation in background. Poll /summary for results."""
    await db.execute(delete(Evaluation))
    await db.commit()

    background_tasks.add_task(
        _run_eval_background,
        request.test_queries or None,
        request.document_ids or None,
    )
    return {"status": "started"}


@router.get("/summary")
async def get_evaluation_summary(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get summary of all evaluations with paginated results."""
    from app.schemas.pagination import PaginatedResponse

    # Get total count
    count_result = await db.execute(select(func.count()).select_from(Evaluation))
    total = count_result.scalar() or 0

    if total == 0:
        return {
            "total_evaluations": 0,
            "avg_retrieval_relevance": None,
            "avg_faithfulness": None,
            "avg_groundedness": None,
            "avg_citation_correctness": None,
            "results": PaginatedResponse.create(items=[], total=0, page=page, page_size=page_size),
        }

    # Compute averages from ALL records
    all_result = await db.execute(select(Evaluation))
    all_evaluations = all_result.scalars().all()

    retrieval = [e.score for e in all_evaluations if e.eval_type == "retrieval_relevance" and e.score]
    faithfulness = [e.score for e in all_evaluations if e.eval_type == "faithfulness" and e.score]
    groundedness = [e.score for e in all_evaluations if e.eval_type == "groundedness" and e.score]
    citation = [e.score for e in all_evaluations if e.eval_type == "citation_correctness" and e.score]

    # Get paginated results
    paginated_result = await db.execute(
        select(Evaluation).order_by(Evaluation.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    paginated_evals = paginated_result.scalars().all()
    eval_results = [EvaluationResult.model_validate(ev) for ev in paginated_evals]

    return {
        "total_evaluations": total,
        "avg_retrieval_relevance": sum(retrieval) / len(retrieval) if retrieval else None,
        "avg_faithfulness": sum(faithfulness) / len(faithfulness) if faithfulness else None,
        "avg_groundedness": sum(groundedness) / len(groundedness) if groundedness else None,
        "avg_citation_correctness": sum(citation) / len(citation) if citation else None,
        "results": PaginatedResponse.create(items=eval_results, total=total, page=page, page_size=page_size),
    }
