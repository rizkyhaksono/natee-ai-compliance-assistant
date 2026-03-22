import json
import logging
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.services.llm import LLMService
from app.services.vector_search import VectorSearchService
from app.services.embedding import EmbeddingService
from app.services.audit import AuditService
from app.prompts.system import get_system_prompt
from app.prompts.gap_analysis import build_gap_analysis_prompt
from app.schemas.gap_analysis import GapAnalysisResponse, GapItem, RiskLevel
from app.models.document import Document
from app.config import get_settings

logger = logging.getLogger(__name__)


class GapAnalysisService:
    """Compares regulation against internal document to find compliance gaps."""

    def __init__(self):
        self.llm = LLMService()
        self.settings = get_settings()

    async def analyze(
        self,
        db: AsyncSession,
        regulation_doc_id: uuid.UUID,
        internal_doc_id: uuid.UUID,
        judgment_mode: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> GapAnalysisResponse:
        mode = judgment_mode or self.settings.judgment_mode

        # Get document names
        reg_doc = await db.get(Document, regulation_doc_id)
        int_doc = await db.get(Document, internal_doc_id)

        if not reg_doc or not int_doc:
            raise ValueError("Document not found")

        # Get all chunks for both documents
        reg_chunks = await self._get_document_chunks(db, regulation_doc_id)
        int_chunks = await self._get_document_chunks(db, internal_doc_id)

        if not reg_chunks:
            raise ValueError(f"No chunks found for regulation document: {reg_doc.name}")

        # Build prompt and generate
        system_prompt = get_system_prompt(mode)
        user_prompt = build_gap_analysis_prompt(reg_chunks, int_chunks)

        raw_response = await self.llm.generate(user_prompt, system_prompt=system_prompt, max_tokens=4096)

        # Parse JSON response
        try:
            json_str = self._extract_json(raw_response)
            result = json.loads(json_str)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse gap analysis response: {e}")
            result = {
                "summary": raw_response,
                "overall_risk": "medium",
                "gaps": [],
            }

        # Build response
        gaps = [
            GapItem(
                regulation_clause=g.get("regulation_clause", ""),
                regulation_text=g.get("regulation_text", ""),
                internal_reference=g.get("internal_reference"),
                internal_text=g.get("internal_text"),
                status=g.get("status", "not_found"),
                risk_level=RiskLevel(g.get("risk_level", "medium")),
                gap_description=g.get("gap_description", ""),
                recommended_action=g.get("recommended_action", ""),
            )
            for g in result.get("gaps", [])
        ]

        compliant = sum(1 for g in gaps if g.status == "compliant")
        partial = sum(1 for g in gaps if g.status == "partial")
        non_compliant = sum(1 for g in gaps if g.status == "non_compliant")
        not_found = sum(1 for g in gaps if g.status == "not_found")

        # Audit log
        audit_log_id = await AuditService.log(
            db, user_id=user_id, action="gap_analysis",
            query=f"Gap analysis: {reg_doc.name} vs {int_doc.name}",
            response=result.get("summary", ""),
            model_used=self.settings.active_llm_model,
            judgment_mode=mode,
        )

        return GapAnalysisResponse(
            regulation_document=reg_doc.name,
            internal_document=int_doc.name,
            total_items=len(gaps),
            compliant_count=compliant,
            partial_count=partial,
            non_compliant_count=non_compliant,
            not_found_count=not_found,
            overall_risk=RiskLevel(result.get("overall_risk", "medium")),
            gaps=gaps,
            summary=result.get("summary", ""),
            audit_log_id=audit_log_id,
        )

    async def _get_document_chunks(self, db: AsyncSession, document_id: uuid.UUID) -> list:
        result = await db.execute(
            text("""
                SELECT content, section, page_number, chunk_index
                FROM chunks WHERE document_id = :doc_id
                ORDER BY chunk_index
            """),
            {"doc_id": str(document_id)},
        )
        return [
            {"content": r.content, "section": r.section, "page_number": r.page_number}
            for r in result.fetchall()
        ]

    @staticmethod
    def _extract_json(raw: str) -> str:
        """Extract and clean JSON from LLM response."""
        import re

        # Strip markdown code fences
        raw = re.sub(r"```(?:json)?\s*", "", raw).strip()

        # Find outermost { ... }
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start < 0 or end <= start:
            raise ValueError("No JSON object found in response")

        candidate = raw[start:end]

        # Try parsing as-is first
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            pass

        # Fix common LLM mistakes: trailing commas before ] or }
        candidate = re.sub(r",\s*([}\]])", r"\1", candidate)

        # Fix unescaped newlines inside string values
        candidate = re.sub(r'(?<=": ")(.*?)(?="[,\n}\]])', lambda m: m.group(0).replace("\n", "\\n"), candidate)

        return candidate
