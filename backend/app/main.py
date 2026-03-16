import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.api import documents, chat, gap_analysis, checklist, audit, evaluation, admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Compliance Assistant...")
    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="AI Compliance Assistant",
    description="AI-powered compliance assistant with RAG, Vector Search, Evaluation, and Guardrails",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(gap_analysis.router)
app.include_router(checklist.router)
app.include_router(audit.router)
app.include_router(evaluation.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {
        "name": "AI Compliance Assistant",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    from app.services.llm import LLMService
    llm = LLMService()
    llm_available = await llm.is_available()
    return {
        "status": "healthy",
        "database": "connected",
        "llm_provider": llm.provider,
        "llm": "available" if llm_available else "unavailable",
    }
