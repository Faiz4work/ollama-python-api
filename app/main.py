"""FastAPI application exposing local Ollama chat as an HTTP API."""

from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from ollama import AsyncClient, ResponseError

from app.config import settings
from app.dependencies import get_ollama_client
from app.schemas import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    HealthResponse,
    ModelsResponse,
)

app = FastAPI(
    title="Ollama Python Chat API",
    description="A small REST API for chatting with locally hosted Ollama models.",
    version="1.0.0",
)

ClientDependency = Annotated[AsyncClient, Depends(get_ollama_client)]


def _messages_for_ollama(request: ChatRequest) -> list[dict[str, str]]:
    messages = [message.model_dump() for message in request.messages]
    if request.system:
        messages.insert(0, {"role": "system", "content": request.system})
    return messages


def _chat_arguments(request: ChatRequest, *, stream: bool) -> dict[str, Any]:
    arguments: dict[str, Any] = {
        "model": request.model or settings.default_model,
        "messages": _messages_for_ollama(request),
        "stream": stream,
    }
    if request.temperature is not None:
        arguments["options"] = {"temperature": request.temperature}
    return arguments


def _ollama_http_error(error: Exception) -> HTTPException:
    if isinstance(error, ResponseError):
        status_code = error.status_code if error.status_code in {400, 404} else 502
        detail = error.error
    else:
        status_code = 503
        detail = (
            "Cannot connect to Ollama. Make sure Ollama is installed and running "
            f"at {settings.ollama_host}."
        )
    return HTTPException(status_code=status_code, detail=detail)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    """Point visitors to the interactive API documentation."""

    return {"message": "Ollama Python Chat API", "docs": "/docs"}


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    """Report whether the web process is running."""

    return HealthResponse()


@app.get("/api/models", response_model=ModelsResponse, tags=["ollama"])
async def list_models(client: ClientDependency) -> ModelsResponse:
    """List the model names downloaded in the connected Ollama instance."""

    try:
        response = await client.list()
    except (ConnectionError, ResponseError) as error:
        raise _ollama_http_error(error) from error

    model_names = [model.model for model in response.models if model.model]
    return ModelsResponse(models=model_names)


@app.post("/api/chat", response_model=ChatResponse, tags=["chat"])
async def chat(request: ChatRequest, client: ClientDependency) -> ChatResponse:
    """Return a complete assistant response for the supplied conversation."""

    try:
        response = await client.chat(**_chat_arguments(request, stream=False))
    except (ConnectionError, ResponseError) as error:
        raise _ollama_http_error(error) from error

    return ChatResponse(
        model=response.model or request.model or settings.default_model,
        message=ChatMessage(
            role="assistant",
            content=response.message.content,
        ),
        done=response.done,
    )


@app.post(
    "/api/chat/stream",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/plain": {}}}},
    tags=["chat"],
)
async def stream_chat(
    request: ChatRequest,
    client: ClientDependency,
) -> StreamingResponse:
    """Stream assistant text chunks as soon as Ollama generates them."""

    try:
        stream = await client.chat(**_chat_arguments(request, stream=True))
    except (ConnectionError, ResponseError) as error:
        raise _ollama_http_error(error) from error

    async def content_chunks() -> AsyncIterator[str]:
        try:
            async for chunk in stream:
                if chunk.message.content:
                    yield chunk.message.content
        except (ConnectionError, ResponseError):
            # The response headers have already been sent, so an HTTP error can no
            # longer be returned. Ending the stream lets the client retry safely.
            return

    return StreamingResponse(content_chunks(), media_type="text/plain; charset=utf-8")

