import uuid
import logging
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.embedding import EmbeddingService
from app.services.vector_search import VectorSearchService
from app.services.llm import LLMService
from app.prompts.qa import build_qa_prompt
from app.prompts.system import get_system_prompt
from app.models.evaluation import Evaluation
from app.config import get_settings

logger = logging.getLogger(__name__)

# Built-in test set for compliance Q&A evaluation
DEFAULT_TEST_QUERIES = [
    {
        "query": "Apa saja persyaratan utama untuk onboarding vendor?",
        "eval_type": "retrieval_relevance",
    },
    {
        "query": "Bagaimana prosedur approval untuk vendor berisiko tinggi?",
        "eval_type": "retrieval_relevance",
    },
    {
        "query": "Apa sanksi jika tidak comply dengan regulasi X?",
        "eval_type": "faithfulness",
    },
    {
        "query": "Ringkas pasal 5 dari regulasi ini",
        "eval_type": "groundedness",
    },
    {
        "query": "Apakah SOP internal sudah sesuai dengan regulasi terbaru?",
        "eval_type": "faithfulness",
    },
]


class EvaluationService:
    """Evaluates RAG pipeline quality."""

    def __init__(self):
        self.llm = LLMService()
        self.settings = get_settings()

    async def _retrieve_chunks_with_fallback(
        self,
        db: AsyncSession,
        query: str,
        document_ids: Optional[List[uuid.UUID]],
    ) -> List[dict]:
        query_embedding = EmbeddingService.embed_query(query)
        thresholds = [float(self.settings.confidence_threshold), 0.3, 0.1, -1.0]
        seen = set()

        for threshold in thresholds:
            if threshold in seen:
                continue
            seen.add(threshold)

            chunks = await VectorSearchService.search(
                db,
                query_embedding,
                top_k=5,
                document_ids=document_ids,
                threshold=threshold,
            )
            if chunks:
                return chunks

        return []

    async def _generate_answer_from_chunks(self, query: str, chunks: List[dict]) -> str:
        if not chunks:
            return "Tidak ditemukan dasar yang cukup dalam dokumen yang tersedia"

        prompt = build_qa_prompt(chunks, query)
        system_prompt = get_system_prompt(self.settings.judgment_mode)
        return await self.llm.generate(prompt, system_prompt=system_prompt)

    async def evaluate_retrieval_relevance(
        self, db: AsyncSession, query: str, document_ids: Optional[List[uuid.UUID]] = None,
    ) -> dict:
        """Check if retrieved chunks are relevant to the query."""
        chunks = await self._retrieve_chunks_with_fallback(db, query, document_ids)

        if not chunks:
            eval_record = Evaluation(
                eval_type="retrieval_relevance",
                query=query,
                retrieved_chunks=[],
                score=0.0,
                details={"reason": "No chunks retrieved"},
            )
            db.add(eval_record)
            await db.commit()
            return {"score": 0.0, "details": {"reason": "No chunks retrieved"}, "chunks": []}

        # Use LLM to evaluate relevance
        eval_prompt = f"""Rate the relevance of each retrieved passage to the query on a scale of 0-1.

Query: {query}

Passages:
{chr(10).join(f'{i+1}. {c["content"][:200]}...' for i, c in enumerate(chunks))}

Output JSON: {{"scores": [0.8, 0.6, ...], "avg_score": 0.7, "reasoning": "..."}}"""

        try:
            response = await self.llm.generate(eval_prompt, temperature=0.0)
            import json
            start = response.find("{")
            end = response.rfind("}") + 1
            result = json.loads(response[start:end])
            score = result.get("avg_score", 0.0)
        except Exception:
            # Fallback: use average cosine similarity as score
            score = sum(c["relevance_score"] for c in chunks) / len(chunks)
            result = {"fallback": True, "avg_similarity": score}

        eval_record = Evaluation(
            eval_type="retrieval_relevance",
            query=query,
            retrieved_chunks=[str(c["chunk_id"]) for c in chunks],
            score=score,
            details=result,
        )
        db.add(eval_record)
        await db.commit()

        return {"score": score, "details": result, "chunks": chunks}

    async def evaluate_faithfulness(
        self, db: AsyncSession, query: str, answer: str, context_chunks: List[dict],
    ) -> dict:
        """Check if the answer is faithful to the source documents."""
        context = "\n".join(c.get("content", "")[:300] for c in context_chunks)
        eval_prompt = f"""Evaluate if the answer is faithful to (supported by) the provided context.

Context:
{context}

Answer:
{answer}

Rate faithfulness 0-1 and explain. Output JSON: {{"score": 0.8, "reasoning": "...", "unsupported_claims": [...]}}"""

        try:
            response = await self.llm.generate(eval_prompt, temperature=0.0)
            import json
            start = response.find("{")
            end = response.rfind("}") + 1
            result = json.loads(response[start:end])
            score = result.get("score", 0.0)
        except Exception:
            score = 0.5
            result = {"fallback": True}

        eval_record = Evaluation(
            eval_type="faithfulness",
            query=query,
            actual_answer=answer,
            score=score,
            details=result,
        )
        db.add(eval_record)
        await db.commit()

        return {"score": score, "details": result}

    async def evaluate_groundedness(
        self, db: AsyncSession, query: str, answer: str,
    ) -> dict:
        """Check if the answer properly cites sources."""
        eval_prompt = f"""Evaluate if this answer properly cites its sources (document names, sections, pages).

Answer:
{answer}

Rate citation quality 0-1. Output JSON: {{"score": 0.8, "has_citations": true, "citation_count": 3, "reasoning": "..."}}"""

        try:
            response = await self.llm.generate(eval_prompt, temperature=0.0)
            import json
            start = response.find("{")
            end = response.rfind("}") + 1
            result = json.loads(response[start:end])
            score = result.get("score", 0.0)
        except Exception:
            score = 0.5
            result = {"fallback": True}

        eval_record = Evaluation(
            eval_type="groundedness",
            query=query,
            actual_answer=answer,
            score=score,
            details=result,
        )
        db.add(eval_record)
        await db.commit()

        return {"score": score, "details": result}

    async def run_evaluation_suite(
        self, db: AsyncSession, test_queries: Optional[List[str]] = None,
        document_ids: Optional[List[uuid.UUID]] = None,
    ) -> dict:
        """Run the full evaluation suite."""
        if test_queries:
            cases = [{"query": q, "eval_type": "retrieval_relevance"} for q in test_queries]
        else:
            cases = DEFAULT_TEST_QUERIES

        results = []

        for case in cases:
            query = case["query"]
            eval_type = case.get("eval_type", "retrieval_relevance")

            if eval_type == "retrieval_relevance":
                result = await self.evaluate_retrieval_relevance(db, query, document_ids)
                results.append({"query": query, "type": eval_type, "score": result["score"], "details": result["details"]})
                continue

            # For faithfulness/groundedness, retrieve context then generate answer first.
            retrieval = await self.evaluate_retrieval_relevance(db, query, document_ids)
            chunks = retrieval.get("chunks", [])

            if not chunks:
                fallback_score = 0.0
                details = {"reason": "No chunks retrieved"}
                eval_record = Evaluation(
                    eval_type=eval_type,
                    query=query,
                    actual_answer="",
                    score=fallback_score,
                    details=details,
                )
                db.add(eval_record)
                await db.commit()
                results.append({"query": query, "type": eval_type, "score": fallback_score, "details": details})
                continue

            answer = await self._generate_answer_from_chunks(query, chunks)

            if eval_type == "faithfulness":
                result = await self.evaluate_faithfulness(db, query, answer, chunks)
            else:
                result = await self.evaluate_groundedness(db, query, answer)

            results.append({"query": query, "type": eval_type, "score": result["score"], "details": result["details"]})

        retrieval_scores = [r["score"] for r in results if r["type"] == "retrieval_relevance"]
        faithfulness_scores = [r["score"] for r in results if r["type"] == "faithfulness"]
        groundedness_scores = [r["score"] for r in results if r["type"] == "groundedness"]

        return {
            "total_evaluations": len(results),
            "avg_retrieval_relevance": (sum(retrieval_scores) / len(retrieval_scores)) if retrieval_scores else None,
            "avg_faithfulness": (sum(faithfulness_scores) / len(faithfulness_scores)) if faithfulness_scores else None,
            "avg_groundedness": (sum(groundedness_scores) / len(groundedness_scores)) if groundedness_scores else None,
            "results": results,
        }
