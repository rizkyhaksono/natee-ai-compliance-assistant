import logging
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.schemas.evaluation import EvaluationRunRequest, EvaluationSummary, EvaluationResult
from app.services.evaluation import EvaluationService
from app.models.evaluation import Evaluation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


@router.post("/run", response_model=EvaluationSummary)
async def run_evaluation(
    request: EvaluationRunRequest,
    db: AsyncSession = Depends(get_db),
):
    """Run the evaluation suite against the current document set."""
    service = EvaluationService()
    try:
        result = await service.run_evaluation_suite(
            db, test_queries=request.test_queries, document_ids=request.document_ids,
        )
        # Convert to response
        eval_results = []
        query = select(Evaluation).order_by(Evaluation.created_at.desc()).limit(len(result.get("results", [])))
        db_results = await db.execute(query)
        for ev in db_results.scalars().all():
            eval_results.append(EvaluationResult.model_validate(ev))

        return EvaluationSummary(
            total_evaluations=result["total_evaluations"],
            avg_retrieval_relevance=result.get("avg_retrieval_relevance"),
            results=eval_results,
        )
    except Exception as e:
        logger.error(f"Evaluation error: {e}")
        raise HTTPException(500, f"Error running evaluation: {str(e)}")


@router.get("/summary", response_model=EvaluationSummary)
async def get_evaluation_summary(db: AsyncSession = Depends(get_db)):
    """Get summary of all evaluations."""
    result = await db.execute(select(Evaluation).order_by(Evaluation.created_at.desc()).limit(100))
    evaluations = result.scalars().all()

    if not evaluations:
        return EvaluationSummary(total_evaluations=0, results=[])

    eval_results = [EvaluationResult.model_validate(ev) for ev in evaluations]

    retrieval = [e.score for e in evaluations if e.eval_type == "retrieval_relevance" and e.score]
    faithfulness = [e.score for e in evaluations if e.eval_type == "faithfulness" and e.score]
    groundedness = [e.score for e in evaluations if e.eval_type == "groundedness" and e.score]
    citation = [e.score for e in evaluations if e.eval_type == "citation_correctness" and e.score]

    return EvaluationSummary(
        total_evaluations=len(evaluations),
        avg_retrieval_relevance=sum(retrieval) / len(retrieval) if retrieval else None,
        avg_faithfulness=sum(faithfulness) / len(faithfulness) if faithfulness else None,
        avg_groundedness=sum(groundedness) / len(groundedness) if groundedness else None,
        avg_citation_correctness=sum(citation) / len(citation) if citation else None,
        results=eval_results,
    )
