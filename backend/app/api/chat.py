import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.rag import RAGService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Q&A endpoint using RAG pipeline."""
    rag_service = RAGService()
    try:
        response = await rag_service.query(
            db=db,
            query=request.query,
            document_ids=request.document_ids,
            judgment_mode=request.judgment_mode,
        )
        return response
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(500, f"Error processing query: {str(e)}")


@router.post("/stream")
async def chat_stream(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Streaming Q&A endpoint."""
    from app.services.embedding import EmbeddingService
    from app.services.vector_search import VectorSearchService
    from app.services.llm import LLMService
    from app.services.guardrails import GuardrailsService
    from app.prompts.system import get_system_prompt
    from app.prompts.qa import build_qa_prompt
    from app.config import get_settings

    settings = get_settings()
    guardrails = GuardrailsService()

    input_flags = guardrails.check_input(request.query)
    if input_flags.get("blocked"):
        return StreamingResponse(
            iter([json.dumps({"error": "Query blocked by guardrails"})]),
            media_type="text/event-stream",
        )

    mode = request.judgment_mode or settings.judgment_mode
    query_embedding = EmbeddingService.embed_query(request.query)
    chunks = await VectorSearchService.search(
        db, query_embedding, top_k=settings.max_context_chunks,
        document_ids=request.document_ids,
    )

    system_prompt = get_system_prompt(mode)
    user_prompt = build_qa_prompt(chunks, request.query)

    llm = LLMService()

    async def generate():
        # Send sources first
        sources_data = [
            {
                "chunk_id": str(c["chunk_id"]),
                "document_name": c["document_name"],
                "section": c.get("section"),
                "relevance_score": c["relevance_score"],
            }
            for c in chunks
        ]
        yield f"data: {json.dumps({'type': 'sources', 'data': sources_data})}\n\n"

        # Stream answer
        async for token in llm.generate_stream(user_prompt, system_prompt=system_prompt):
            yield f"data: {json.dumps({'type': 'token', 'data': token})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
