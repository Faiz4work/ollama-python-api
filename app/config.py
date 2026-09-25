"""Application configuration loaded from environment variables."""

from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True)
class Settings:
    """Runtime settings for the API and the Ollama connection."""

    ollama_host: str = getenv("OLLAMA_HOST", "http://localhost:11434")
    default_model: str = getenv("OLLAMA_MODEL", "llama3.2:1b")
    request_timeout: float = float(getenv("OLLAMA_TIMEOUT", "120"))


settings = Settings()

