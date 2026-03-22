import logging
import math
from typing import List, Optional
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)


def _normalize(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return vec
    return [x / norm for x in vec]


class EmbeddingService:
    """Generates embeddings via Ollama embedding API."""

    @staticmethod
    def _clean_text(text: str) -> Optional[str]:
        normalized = " ".join(text.split())
        if not normalized:
            return None
        # Keep payload size bounded to avoid API 400 due to oversized input.
        return normalized[:8000]

    @staticmethod
    def _embed_one(text: str) -> List[float]:
        settings = get_settings()
        timeout = httpx.Timeout(120.0)
        cleaned = EmbeddingService._clean_text(text)
        if cleaned is None:
            raise ValueError("Cannot embed empty text")

        attempts = [
            ("/api/embed", {"model": settings.embedding_model, "input": cleaned}),
            ("/api/embed", {"model": settings.embedding_model, "input": [cleaned]}),
            ("/api/embeddings", {"model": settings.embedding_model, "prompt": cleaned}),
        ]
        last_error: Optional[str] = None

        with httpx.Client(timeout=timeout) as client:
            for path, payload in attempts:
                response = client.post(f"{settings.ollama_base_url}{path}", json=payload)
                if response.status_code in (400, 404):
                    last_error = f"{path} returned {response.status_code}"
                    continue

                response.raise_for_status()
                data = response.json()

                if "embeddings" in data and data["embeddings"]:
                    vec = data["embeddings"][0]
                elif "embedding" in data:
                    vec = data["embedding"]
                else:
                    last_error = "Ollama embedding response missing vector data"
                    continue

                return _normalize(vec)

        raise RuntimeError(last_error or "Embedding request failed")

    @staticmethod
    def embed_texts(texts: List[str]) -> List[List[float]]:
        vectors: List[List[float]] = []
        for text in texts:
            cleaned = EmbeddingService._clean_text(text)
            if cleaned is None:
                continue
            vectors.append(EmbeddingService._embed_one(cleaned))
        return vectors

    @staticmethod
    def embed_query(query: str) -> List[float]:
        return EmbeddingService._embed_one(query)

    @staticmethod
    def get_dimension() -> int:
        settings = get_settings()
        # Pull one embedding to infer dimensionality from active embedding model.
        return len(EmbeddingService._embed_one(f"dim_check:{settings.embedding_model}"))
