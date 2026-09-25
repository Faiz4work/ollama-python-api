"""API tests using a fake Ollama client (no local model is required)."""

from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any

from fastapi.testclient import TestClient

from app.dependencies import get_ollama_client
from app.main import app


class FakeOllamaClient:
    """Small test double implementing the Ollama methods used by the API."""

    def __init__(self) -> None:
        self.last_chat_arguments: dict[str, Any] = {}

    async def list(self) -> SimpleNamespace:
        return SimpleNamespace(
            models=[
                SimpleNamespace(model="llama3.2:1b"),
                SimpleNamespace(model="gemma3:4b"),
            ]
        )

    async def chat(self, **arguments: Any) -> Any:
        self.last_chat_arguments = arguments
        if arguments["stream"]:
            return self._stream()
        return SimpleNamespace(
            model=arguments["model"],
            message=SimpleNamespace(content="The sky looks blue because of scattering."),
            done=True,
        )

    async def _stream(self) -> AsyncIterator[SimpleNamespace]:
        for text in ("Hello", " from", " Ollama!"):
            yield SimpleNamespace(message=SimpleNamespace(content=text))


fake_ollama = FakeOllamaClient()
app.dependency_overrides[get_ollama_client] = lambda: fake_ollama
client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_models() -> None:
    response = client.get("/api/models")

    assert response.status_code == 200
    assert response.json() == {"models": ["llama3.2:1b", "gemma3:4b"]}


def test_chat_uses_history_system_prompt_and_temperature() -> None:
    response = client.post(
        "/api/chat",
        json={
            "model": "llama3.2:1b",
            "system": "Reply in one short sentence.",
            "temperature": 0.4,
            "messages": [
                {"role": "user", "content": "What color is the sky?"},
                {"role": "assistant", "content": "Usually blue."},
                {"role": "user", "content": "Why?"},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "model": "llama3.2:1b",
        "message": {
            "role": "assistant",
            "content": "The sky looks blue because of scattering.",
        },
        "done": True,
    }
    assert fake_ollama.last_chat_arguments["messages"][0] == {
        "role": "system",
        "content": "Reply in one short sentence.",
    }
    assert fake_ollama.last_chat_arguments["options"] == {"temperature": 0.4}


def test_stream_chat_returns_generated_chunks() -> None:
    with client.stream(
        "POST",
        "/api/chat/stream",
        json={"messages": [{"role": "user", "content": "Say hello."}]},
    ) as response:
        content = "".join(response.iter_text())

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert content == "Hello from Ollama!"


def test_empty_messages_are_rejected() -> None:
    response = client.post("/api/chat", json={"messages": []})

    assert response.status_code == 422

