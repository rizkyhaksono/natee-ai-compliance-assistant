import logging
import numpy as np
from typing import List
from sentence_transformers import SentenceTransformer
from app.config import get_settings

logger = logging.getLogger(__name__)

_model = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        settings = get_settings()
        logger.info(f"Loading embedding model: {settings.embedding_model}")
        _model = SentenceTransformer(settings.embedding_model)
        logger.info("Embedding model loaded")
    return _model


class EmbeddingService:
    """Generates embeddings using sentence-transformers."""

    @staticmethod
    def embed_texts(texts: List[str]) -> List[List[float]]:
        model = _get_model()
        embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
        return embeddings.tolist()

    @staticmethod
    def embed_query(query: str) -> List[float]:
        model = _get_model()
        embedding = model.encode([query], show_progress_bar=False, normalize_embeddings=True)
        return embedding[0].tolist()

    @staticmethod
    def get_dimension() -> int:
        model = _get_model()
        return model.get_sentence_embedding_dimension()
