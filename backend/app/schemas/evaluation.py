from pydantic import BaseModel
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


class EvaluationResult(BaseModel):
    id: UUID
    eval_type: str
    query: str
    score: Optional[float] = None
    details: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EvaluationRunRequest(BaseModel):
    test_queries: Optional[List[str]] = None  # if None, use built-in test set
    document_ids: Optional[List[UUID]] = None


class EvaluationSummary(BaseModel):
    total_evaluations: int
    avg_retrieval_relevance: Optional[float] = None
    avg_faithfulness: Optional[float] = None
    avg_groundedness: Optional[float] = None
    avg_citation_correctness: Optional[float] = None
    results: List[EvaluationResult]
