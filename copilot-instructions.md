---
name: "Natee AI Compliance Assistant"
description: "Project guidelines for AI-powered compliance analysis platform. RAG-based system using FastAPI + Next.js with Ollama LLM."
---

# Natee AI Compliance Assistant - Copilot Instructions

Full-stack compliance analysis platform that uses Retrieval-Augmented Generation (RAG) to analyze documents, perform gap analysis, and generate compliance reports.

## Tech Stack

**Backend:**
- FastAPI + Python 3.9+
- PostgreSQL with pgvector for embeddings
- Ollama (qwen3.5:2b) for LLM
- all-minilm-L6-v2 for embeddings

**Frontend:**
- Next.js 14 (App Router)
- React 18 + TypeScript (strict mode)
- Tailwind CSS

**Infrastructure:**
- Docker + Docker Compose
- PostgreSQL 15+

## Quick Navigation

- **Backend Development**: See `.github/instructions/backend.instructions.md`
  - API endpoints, database models, RAG service
  - Type hints, async patterns, audit logging
  
- **Frontend Development**: See `.github/instructions/frontend.instructions.md`
  - React components, TypeScript patterns
  - API client, Tailwind styling
  - Error handling and state management

## Key Commands

```bash
# Backend
cd backend
make start          # Run dev server (FastAPI on 8050)
make test           # Run tests
make lint           # Check code

# Frontend
cd frontend
bun dev            # Run dev server (Next.js on 3000)
bun test           # Run tests
bun lint           # Check code
```

## Project Structure

```
.github/
  instructions/
    backend.instructions.md
    frontend.instructions.md

backend/
  app/
    api/              # API routes (one file per feature)
    models/           # SQLAlchemy ORM models
    schemas/          # Pydantic validation schemas
    services/         # Business logic (RAG, LLM, etc.)
    prompts/          # LLM prompt templates
  tests/
  requirements.txt
  Makefile

frontend/
  src/
    app/              # Next.js pages (app router)
    components/       # React components
    lib/              # Utilities (API client)
    hooks/            # Custom React hooks
    types/            # TypeScript interfaces

docker-compose.yml
.env                  # Local environment variables
.env.example
```

## Environment Setup

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=db_compliance_assistant
POSTGRES_USER=root
POSTGRES_PASSWORD=rootiniboss123

# LLM
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://172.29.176.1:11434
OLLAMA_MODEL=qwen3.5:2b

# Embeddings
EMBEDDING_MODEL=all-minilm

# Compliance
MAX_CONTEXT_CHUNKS=10          # Max chunks in RAG context
CONFIDENCE_THRESHOLD=0.5       # Min confidence for retrieval
JUDGMENT_MODE=moderate         # LLM judgment mode
MAX_UPLOAD_SIZE_MB=50          # Max file upload size
UPLOAD_DIR=/app/uploads
```

## Code Style Summary

### Python (Backend)
- Type hints for everything (PEP 484)
- Async/await for I/O operations
- Pydantic schemas for validation
- SQLAlchemy ORM for database
- Comprehensive error handling
- Audit logging for compliance

### TypeScript (Frontend)
- Strict mode enabled
- Explicit types (avoid `any`)
- React hooks for state
- Tailwind CSS for styling
- Error boundaries & loading states
- Centralized API client (`lib/api.ts`)

## Core Features

### 1. Document Management
- Upload compliance documents (PDF, DOCX, TXT)
- Automatic chunking and embedding
- Vector similarity search

### 2. RAG System
- Retrieve relevant document chunks
- Generate context-aware answers
- Confidence scoring

### 3. Compliance Analysis
- Gap analysis against regulations
- Audit trail for all actions
- Evaluation reports

### 4. Admin Dashboard
- User management
- Audit log viewing
- System configuration

## Important Patterns

### Backend - API Endpoint
```python
@router.post("/api/documents/upload")
async def upload_document(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    service: DocumentParserService = Depends(),
) -> DocumentResponse:
    """Always include docstrings and error handling."""
    try:
        # Validate, process, audit log
        doc = await service.parse_and_store(file, current_user.id)
        await audit_log(user_id=current_user.id, action="document:upload", ...)
        return doc
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error message")
```

### Frontend - Page Component
```typescript
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Document } from '@/types';

export default function DocumentsPage() {
  const [data, setData] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const docs = await apiClient.get<Document[]>('/documents');
        setData(docs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setLoading(false);
      }
    };
    
    fetch();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return <div>{/* render data */}</div>;
}
```

## Testing

### Backend
```bash
cd backend
pytest tests/              # Run all tests
mypy .                    # Type checking
black . --check           # Code formatting
```

### Frontend
```bash
cd frontend
bun test                  # Run vitest
tsc --noEmit             # Type checking
```

## When Implementing Features

1. **Start with types** (schemas/interfaces)
2. **Write tests** (test cases)
3. **Implement logic** (services/components)
4. **Create routes/pages** (API/UI)
5. **Add audit logging** (backend only)
6. **Error handling** (both layers)
7. **Documentation** (docstrings/comments)

## Common Gotchas

❌ Don't:
- Use `any` type in TypeScript
- Skip error handling
- Forget audit logs for data changes
- Hardcode API URLs (use env vars)
- Block the event loop with sync code
- Expose sensitive info in error messages

✅ Do:
- Always include type hints
- Use try-catch with logging
- Log user actions for compliance
- Use centralized config
- Use async/await
- Return generic error messages

## References

- **Backend Guide**: `.github/instructions/backend.instructions.md`
- **Frontend Guide**: `.github/instructions/frontend.instructions.md`
- **API Endpoints**: `backend/app/api/`
- **Database Models**: `backend/app/models/`
- **Type Definitions**: `frontend/src/types/`
- **Components**: `frontend/src/components/`

## Support

For questions about:
- **Backend patterns** → Check backend.instructions.md
- **Frontend patterns** → Check frontend.instructions.md
- **API integration** → Check `lib/api.ts` and existing endpoints
- **Database** → Check models and migrations
- **Styling** → Check Tailwind docs and existing components
