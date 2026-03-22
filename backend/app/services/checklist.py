import json
import logging
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.services.llm import LLMService
from app.services.audit import AuditService
from app.prompts.system import get_system_prompt
from app.prompts.checklist import build_checklist_prompt
from app.schemas.checklist import ChecklistResponse, ChecklistItem, Priority
from app.models.document import Document
from app.config import get_settings

logger = logging.getLogger(__name__)


class ChecklistService:
    """Generates compliance checklists from regulation documents."""

    def __init__(self):
        self.llm = LLMService()
        self.settings = get_settings()

    async def generate(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        focus_area: Optional[str] = None,
        judgment_mode: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> ChecklistResponse:
        mode = judgment_mode or self.settings.judgment_mode

        doc = await db.get(Document, document_id)
        if not doc:
            raise ValueError("Document not found")

        # Get document chunks
        result = await db.execute(
            text("SELECT content, section, page_number FROM chunks WHERE document_id = :doc_id ORDER BY chunk_index"),
            {"doc_id": str(document_id)},
        )
        chunks = [
            {"content": r.content, "section": r.section, "page_number": r.page_number}
            for r in result.fetchall()
        ]

        if not chunks:
            raise ValueError(f"No chunks found for document: {doc.name}")

        system_prompt = get_system_prompt(mode)
        user_prompt = build_checklist_prompt(chunks, focus_area)

        raw_response = await self.llm.generate(user_prompt, system_prompt=system_prompt, max_tokens=4096)

        # Parse JSON
        try:
            import re
            cleaned = re.sub(r"```(?:json)?\s*", "", raw_response).strip()
            start = cleaned.find("{")
            end = cleaned.rfind("}") + 1
            candidate = cleaned[start:end] if start >= 0 and end > start else ""
            if not candidate:
                raise ValueError("No JSON found")
            try:
                result_data = json.loads(candidate)
            except json.JSONDecodeError:
                candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
                result_data = json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            logger.error("Failed to parse checklist response")
            result_data = {"summary": raw_response, "items": []}

        items = [
            ChecklistItem(
                item_number=item.get("item_number", i + 1),
                requirement=item.get("requirement", ""),
                source_clause=item.get("source_clause", ""),
                priority=Priority(item.get("priority", "medium")),
                action_needed=item.get("action_needed", ""),
                responsible_party=item.get("responsible_party"),
                deadline_suggestion=item.get("deadline_suggestion"),
                notes=item.get("notes"),
            )
            for i, item in enumerate(result_data.get("items", []))
        ]

        audit_log_id = await AuditService.log(
            db, user_id=user_id, action="checklist_generation",
            query=f"Checklist for: {doc.name}" + (f" (focus: {focus_area})" if focus_area else ""),
            response=result_data.get("summary", ""),
            model_used=self.settings.active_llm_model, judgment_mode=mode,
        )

        return ChecklistResponse(
            document_name=doc.name,
            focus_area=focus_area,
            total_items=len(items),
            items=items,
            summary=result_data.get("summary", ""),
            audit_log_id=audit_log_id,
        )
