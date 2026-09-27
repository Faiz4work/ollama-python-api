"""Application configuration loaded from environment variables."""

from dataclasses import dataclass
from os import getenv


def _cors_origins() -> tuple[str, ...]:
    value = getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return tuple(origin.strip() for origin in value.split(",") if origin.strip())


@dataclass(frozen=True)
class Settings:
    """Runtime settings for the API and the Ollama connection."""

    ollama_host: str = getenv("OLLAMA_HOST", "http://localhost:11434")
    default_model: str = getenv("OLLAMA_MODEL", "llama3.2:1b")
    request_timeout: float = float(getenv("OLLAMA_TIMEOUT", "120"))
    cors_origins: tuple[str, ...] = _cors_origins()


settings = Settings()
