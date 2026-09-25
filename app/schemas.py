"""Request and response models exposed by the HTTP API."""

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """One message in a conversation."""

    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    """A chat request with optional model and generation settings."""

    messages: list[ChatMessage] = Field(min_length=1)
    model: str | None = Field(default=None, min_length=1)
    system: str | None = Field(default=None, min_length=1)
    temperature: float | None = Field(default=None, ge=0, le=2)


class ChatResponse(BaseModel):
    """The assistant response returned by Ollama."""

    model: str
    message: ChatMessage
    done: bool = True


class ModelsResponse(BaseModel):
    """The model names currently available in Ollama."""

    models: list[str]


class HealthResponse(BaseModel):
    """Basic process health response."""

    status: Literal["ok"] = "ok"

