from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "compliance_assistant"
    postgres_user: str = "compliance"
    postgres_password: str = "compliance_secret"

    # LLM
    llm_provider: str = "ollama"  # ollama or bedrock_nova

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"

    # AWS Bedrock (Nova)
    aws_region: str = "us-east-1"
    aws_bedrock_model_id: str = "amazon.nova-lite-v1:0"

    # Embedding
    embedding_model: str = "all-MiniLM-L6-v2"

    # Backend
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
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
        if self.llm_provider.lower() == "bedrock_nova":
            return self.aws_bedrock_model_id
        return self.ollama_model

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
