# AI Compliance Assistant

AI-powered compliance assistant that analyzes regulations and internal SOPs using LLMs, embeddings, RAG, and vector search. Implements evaluation pipelines for answer quality and guardrails for access control, grounded responses, and policy-safe outputs.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js UI    │────▶│  FastAPI Backend  │────▶│  PostgreSQL +   │
│  (Chat, Upload, │     │  (RAG Pipeline,   │     │  pgvector       │
│   Dashboard)    │     │   Guardrails,     │     │  (documents,    │
│                 │     │   Evaluation)     │     │   embeddings,   │
└─────────────────┘     └────────┬─────────┘     │   audit logs)   │
                                 │                └─────────────────┘
                        ┌────────┴─────────┐
                        │ LLM Provider:    │
                        │ Ollama           │
                        │ Ollama Embeddings │
                        └──────────────────┘
```

## Tech Stack

- **Backend**: Python + FastAPI
- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **Vector DB**: PostgreSQL + pgvector
- **LLM**: Ollama (local)
- **Embeddings**: Ollama embeddings (`all-minilm`)
- **Infrastructure**: Docker Compose

## Features

### A. Regulation Q&A (RAG)
Chat-based Q&A grounded in uploaded regulations and SOPs. Every answer includes source citations, confidence scores, and document references.

### B. Gap Analysis
Compare a regulation against an internal document to identify:
- Compliant areas
- Partial compliance
- Non-compliant gaps
- Risk levels and recommended actions

### C. Compliance Checklist Generator
Auto-generate implementation checklists from regulations with priorities, responsible parties, and deadlines.

### D. Audit Trail
Full audit logging of all AI interactions with:
- Source chunks used
- Timestamps and model info
- Reviewer feedback and scores

### E. Evaluation Dashboard
Measure system quality with metrics:
- Retrieval relevance
- Answer faithfulness
- Groundedness
- Citation correctness

### F. Policy Judgment Layer
Configurable judgment modes:
- **Conservative**: Strict interpretation, flag all risks
- **Moderate**: Balanced, material gaps only
- **Lenient**: Flexible, critical issues only

### G. Guardrails
- Prompt injection detection
- Off-topic query filtering
- Legal conclusion prevention
- Source citation enforcement
- Sensitive data redaction
- Confidence/evidence levels

## Quick Start

### Prerequisites
- Docker & Docker Compose
- PostgreSQL + pgvector already deployed and reachable from backend container
- (Optional) NVIDIA GPU for faster LLM inference

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env if needed
# Important: set POSTGRES_HOST/POSTGRES_PORT to your deployed PostgreSQL
```

### 2. Start services

```bash
docker compose up -d
```

### 3. Configure Ollama

Set in `.env`:

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen3.5:4b
EMBEDDING_MODEL=all-minilm
```

Pull chat + embedding models from host Ollama:

```bash
ollama pull qwen3.5:4b
ollama pull all-minilm
```

### 4. Access the application

- **Frontend**: http://localhost:3050
- **Backend API**: http://localhost:8050
- **API Docs**: http://localhost:8050/docs

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload document (PDF/DOCX/TXT) |
| GET | `/api/documents/` | List all documents |
| GET | `/api/documents/{id}` | Get document details |
| DELETE | `/api/documents/{id}` | Delete document |
| POST | `/api/chat/` | Q&A with RAG |
| POST | `/api/chat/stream` | Streaming Q&A |
| POST | `/api/gap-analysis/` | Run gap analysis |
| POST | `/api/checklist/` | Generate checklist |
| GET | `/api/audit/` | Get audit logs |
| POST | `/api/audit/{id}/feedback` | Add reviewer feedback |
| POST | `/api/evaluation/run` | Run evaluation suite |
| GET | `/api/evaluation/summary` | Get evaluation metrics |
| GET | `/api/admin/config` | Get system config |
| PUT | `/api/admin/config` | Update runtime config |
| GET | `/health` | Health check (includes active LLM provider) |

## Project Structure

```
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI app
│       ├── config.py            # Settings
│       ├── database.py          # DB connection
│       ├── models/              # SQLAlchemy models
│       ├── schemas/             # Pydantic schemas
│       ├── api/                 # Route handlers
│       ├── services/            # Business logic
│       │   ├── document_parser.py  # PDF/DOCX parsing
│       │   ├── chunking.py         # Text chunking
│       │   ├── embedding.py        # Ollama embeddings
│       │   ├── vector_search.py    # pgvector similarity search
│       │   ├── llm.py              # Ollama integration
│       │   ├── rag.py              # RAG pipeline
│       │   ├── gap_analysis.py     # Gap analysis
│       │   ├── checklist.py        # Checklist generation
│       │   ├── guardrails.py       # Input/output guardrails
│       │   ├── evaluation.py       # Quality evaluation
│       │   └── audit.py            # Audit logging
│       └── prompts/             # Prompt templates
│           ├── system.py           # System prompts + judgment modes
│           ├── qa.py               # Q&A prompts
│           ├── gap_analysis.py     # Gap analysis prompts
│           └── checklist.py        # Checklist prompts
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── app/                 # Next.js pages
        │   ├── page.tsx            # Chat/Q&A
        │   ├── documents/          # Document management
        │   ├── gap-analysis/       # Gap analysis
        │   ├── checklist/          # Checklist generator
        │   ├── audit/              # Audit trail viewer
        │   ├── evaluation/         # Evaluation dashboard
        │   └── admin/              # Admin panel
        ├── components/          # Shared components
        └── lib/api.ts           # API client
```

## Key Concepts Demonstrated

| Concept | Implementation |
|---------|---------------|
| **LLM** | Provider abstraction for Ollama |
| **Prompt Engineering** | System prompts, judgment modes, structured output |
| **Embeddings** | Ollama embedding API for semantic document representation |
| **RAG** | Retrieve → Augment → Generate pipeline with citations |
| **Vector DB** | pgvector for similarity search with metadata filtering |
| **Evaluation** | Retrieval relevance, faithfulness, groundedness metrics |
| **Guardrails** | Input validation, output sanitization, access control |

## License

MIT
