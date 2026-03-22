import json
import logging
import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.embedding import EmbeddingService
from app.services.vector_search import VectorSearchService
from app.services.llm import LLMService
from app.services.guardrails import GuardrailsService
from app.services.audit import AuditService
from app.prompts.system import get_system_prompt
from app.prompts.qa import build_qa_prompt
from app.config import get_settings
from app.schemas.chat import ChatResponse, SourceChunk

logger = logging.getLogger(__name__)


class RAGService:
    """Orchestrates the RAG pipeline: retrieve → augment → generate."""

    def __init__(self):
        self.llm = LLMService()
        self.guardrails = GuardrailsService()
        self.settings = get_settings()

    async def _retrieve_chunks_with_fallback(
        self,
        db: AsyncSession,
        query_embedding: List[float],
        document_ids: Optional[List[uuid.UUID]],
    ) -> tuple[List[dict], bool]:
        """Try strict-to-relaxed thresholds to reduce empty retrievals."""
        configured = float(self.settings.confidence_threshold)
        thresholds = [configured, 0.3, 0.1, -1.0]
        seen = set()

        for threshold in thresholds:
            # Preserve order while removing duplicates.
            if threshold in seen:
                continue
            seen.add(threshold)

            chunks = await VectorSearchService.search(
                db,
                query_embedding,
                top_k=self.settings.max_context_chunks,
                document_ids=document_ids,
                threshold=threshold,
            )
            if chunks:
                used_fallback = threshold < configured
                return chunks, used_fallback

        return [], False

    async def query(
        self,
        db: AsyncSession,
        query: str,
        document_ids: Optional[List[uuid.UUID]] = None,
        judgment_mode: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> ChatResponse:
        mode = judgment_mode or self.settings.judgment_mode

        # Input guardrails
        input_flags = self.guardrails.check_input(query)
        if input_flags.get("blocked"):
            audit_log_id = await AuditService.log(
                db, user_id=user_id, action="qa_query", query=query,
                response="[BLOCKED]", guardrail_flags=input_flags.get("flags", []),
            )
            return ChatResponse(
                answer="Pertanyaan tidak dapat diproses karena melanggar kebijakan penggunaan.",
                sources=[],
                confidence=0.0,
                guardrail_flags=input_flags.get("flags", []),
                audit_log_id=audit_log_id,
            )

        # Retrieve
        query_embedding = EmbeddingService.embed_query(query)
        chunks, used_fallback = await self._retrieve_chunks_with_fallback(
            db,
            query_embedding,
            document_ids,
        )

        if not chunks:
            audit_log_id = await AuditService.log(
                db, user_id=user_id, action="qa_query", query=query,
                response="Tidak ditemukan dokumen yang relevan.",
                confidence_score=0.0, judgment_mode=mode,
            )
            return ChatResponse(
                answer="Tidak ditemukan dokumen yang relevan dengan pertanyaan Anda. Pastikan dokumen yang sesuai sudah di-upload.",
                sources=[],
                confidence=0.0,
                guardrail_flags=[],
                audit_log_id=audit_log_id,
            )

        # Augment
        system_prompt = get_system_prompt(mode)
        user_prompt = build_qa_prompt(chunks, query)

        # Generate
        answer = await self.llm.generate(user_prompt, system_prompt=system_prompt)

        # Output guardrails
        output_flags = self.guardrails.check_output(answer)
        retrieval_flags = ["retrieval_threshold_relaxed"] if used_fallback else []
        merged_flags = [*retrieval_flags, *output_flags.get("flags", [])]
        if output_flags.get("flags"):
            answer = self.guardrails.sanitize_output(answer, output_flags["flags"])

        # Build sources
        sources = [
            SourceChunk(
                chunk_id=chunk["chunk_id"],
                document_id=chunk["document_id"],
                document_name=chunk["document_name"],
                document_type=chunk["document_type"],
                section=chunk.get("section"),
                page_number=chunk.get("page_number"),
                content=chunk["content"][:500],
                relevance_score=chunk["relevance_score"],
            )
            for chunk in chunks
        ]

        avg_relevance = sum(c["relevance_score"] for c in chunks) / len(chunks) if chunks else 0
        confidence = min(avg_relevance, 1.0)

        # Audit log
        source_chunk_ids = [str(c["chunk_id"]) for c in chunks]
        audit_log_id = await AuditService.log(
            db, user_id=user_id, action="qa_query", query=query,
            response=answer, source_chunks=source_chunk_ids,
            model_used=self.settings.active_llm_model,
            confidence_score=confidence, judgment_mode=mode,
            guardrail_flags=merged_flags,
        )

        return ChatResponse(
            answer=answer,
            sources=sources,
            confidence=confidence,
            guardrail_flags=merged_flags,
            audit_log_id=audit_log_id,
        )
