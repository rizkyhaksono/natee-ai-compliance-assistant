from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

# Find .env: check current dir, then parent dirs up to 3 levels
def _find_env_file() -> str:
    for parent in [Path.cwd()] + list(Path.cwd().parents)[:3]:
        candidate = parent / ".env"
        if candidate.exists():
            return str(candidate)
    return ".env"


class Settings(BaseSettings):
    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "compliance_assistant"
    postgres_user: str = "compliance"
    postgres_password: str = "compliance_secret"

    # LLM
    llm_provider: str = "ollama"  # ollama

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"

    # Embedding
    embedding_model: str = "all-minilm"

    # Backend
    backend_host: str = "0.0.0.0"
    backend_port: int = 8050
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 50

    # Guardrails
    max_context_chunks: int = 10
    confidence_threshold: float = 0.5
    judgment_mode: str = "moderate"  # conservative, moderate, lenient

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def active_llm_model(self) -> str:
        return self.ollama_model

    class Config:
        env_file = _find_env_file()
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
