"""Shared dependencies used by the API routes."""

from ollama import AsyncClient

from app.config import settings


ollama_client = AsyncClient(
    host=settings.ollama_host,
    timeout=settings.request_timeout,
)


def get_ollama_client() -> AsyncClient:
    """Return the application's reusable asynchronous Ollama client."""

    return ollama_client

