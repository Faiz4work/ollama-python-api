# Build a Local AI Chat API with Python, FastAPI, and Ollama

Run a private chat API on your own computer. This project connects a FastAPI
web server to [Ollama](https://ollama.com/), so other programs can chat with a
local large language model through simple HTTP requests.

The project includes:

- normal and streaming chat responses;
- system prompts;
- multi-turn conversation history;
- selectable Ollama models and temperature;
- a model-listing endpoint;
- automatic Swagger and ReDoc documentation; and
- tests that run without downloading a language model.

This tutorial expands the ideas in Jonathan Gastón Löwenstern's
[Using Ollama with Python: A Simple Guide](https://medium.com/@jonigl/using-ollama-with-python-a-simple-guide-0752369e1e55)
into a reusable web API.

## What we are building

The browser, mobile app, command-line client, or another backend sends a chat
request to FastAPI. FastAPI validates it and passes the conversation to the
Ollama Python client. Ollama runs the selected model locally and returns the
assistant's answer.

```text
Client  ->  FastAPI  ->  Ollama  ->  Local model
        <- JSON/text <-         <-
```

Ollama listens at `http://localhost:11434` by default. This project's API
listens at `http://localhost:8000` by default.

## Project structure

```text
ollama-python-api/
|-- app/
|   |-- __init__.py
|   |-- config.py          # Environment-based settings
|   |-- dependencies.py    # Reusable asynchronous Ollama client
|   |-- main.py            # FastAPI routes and Ollama integration
|   `-- schemas.py         # Request and response validation
|-- tests/
|   `-- test_api.py        # API tests using a fake Ollama client
|-- .env.example
|-- .gitignore
|-- requirements.txt
`-- README.md
```

## 1. Prerequisites

Install these before continuing:

- [Python 3.10 or newer](https://www.python.org/downloads/)
- [Ollama](https://ollama.com/download)
- Git (optional, but recommended)

Confirm that Python and Ollama are available:

```bash
python --version
ollama --version
```

## 2. Clone the repository

```bash
git clone https://github.com/Faiz4work/ollama-python-api.git
cd ollama-python-api
```

## 3. Download a model

The default model in this project is Llama 3.2 1B. Pull it once before using
the API:

```bash
ollama pull llama3.2:1b
```

See the models already installed on your computer:

```bash
ollama list
```

You can use a different [Ollama model](https://ollama.com/search) by setting
`OLLAMA_MODEL` or by including `model` in an API request.

## 4. Create a virtual environment

A virtual environment keeps this project's packages separate from packages
used by other Python projects.

### Windows PowerShell

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, run this once in the same terminal and try
again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### macOS or Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install the dependencies:

```bash
python -m pip install -r requirements.txt
```

## 5. Configure the API (optional)

The default settings work with a normal local Ollama installation. To change
them, copy `.env.example` to `.env` and edit the values.

```dotenv
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
OLLAMA_TIMEOUT=120
```

| Variable | Purpose | Default |
| --- | --- | --- |
| `OLLAMA_HOST` | Address of the Ollama server | `http://localhost:11434` |
| `OLLAMA_MODEL` | Model used when a request omits `model` | `llama3.2:1b` |
| `OLLAMA_TIMEOUT` | Maximum wait for Ollama, in seconds | `120` |

## 6. Start Ollama and the Python API

The Ollama desktop application normally starts its service automatically. If
it is not running, open Ollama or start it from a separate terminal:

```bash
ollama serve
```

Start the FastAPI development server from the repository root:

```bash
uvicorn app.main:app --reload
```

If you created a `.env` file, load it with:

```bash
uvicorn app.main:app --reload --env-file .env
```

You should see Uvicorn listening at `http://127.0.0.1:8000`.

Open one of the automatically generated documentation pages:

- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>

Swagger UI lets you expand an endpoint, click **Try it out**, enter JSON, and
send a request without installing a separate API client.

## 7. Send your first chat request

The `/api/chat` endpoint waits for the model to finish, then returns one JSON
response.

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Why is the sky blue?"}
    ]
  }'
```

Windows PowerShell users should run `curl.exe` instead of `curl`, or use the
Swagger UI shown above.

The exact answer varies, but the response has this shape:

```json
{
  "model": "llama3.2:1b",
  "message": {
    "role": "assistant",
    "content": "The sky appears blue because ..."
  },
  "done": true
}
```

### Request fields

| Field | Required | Description |
| --- | --- | --- |
| `messages` | Yes | Conversation messages in chronological order |
| `model` | No | Overrides the default model for this request |
| `system` | No | Instructions that guide the assistant's behavior |
| `temperature` | No | Randomness from `0` to `2`; lower is more predictable |

Each item in `messages` has a `role` (`system`, `user`, or `assistant`) and
non-empty `content`.

## 8. Stream a response

A complete answer may take several seconds. The `/api/chat/stream` endpoint
returns each text chunk immediately, producing the same typing effect shown by
the Python `for chunk in ...` example in the reference article.

The `-N` option tells curl not to buffer the response:

```bash
curl -N -X POST http://127.0.0.1:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Write a two-line poem about Python."}
    ]
  }'
```

This endpoint returns plain text rather than JSON because it sends the answer
before the complete message exists.

## 9. Give the model a system prompt

A system prompt defines how the assistant should behave. The API places the
`system` value before the conversation messages sent to Ollama.

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "system": "You are a helpful pirate. Reply in one short sentence.",
    "messages": [
      {"role": "user", "content": "Tell me about your boat."}
    ]
  }'
```

System prompts can set tone, response length, expertise, output format, or
other rules. They guide a model but do not provide a security boundary, so
server-side code must still validate anything important.

## 10. Preserve conversation history

Ollama does not know about earlier HTTP requests automatically. A client keeps
context by sending earlier user and assistant messages again with each new
request.

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "My name is Faiz."},
      {"role": "assistant", "content": "Nice to meet you, Faiz!"},
      {"role": "user", "content": "What is my name?"}
    ]
  }'
```

The API is deliberately stateless: it does not store conversations or user
data. The calling application decides where history lives and which messages
to send. As a conversation grows, trim or summarize older messages so the
model's context window is not exceeded.

## 11. Select a model and temperature

The model and generation temperature can be changed for one request:

```json
{
  "model": "gemma3:4b",
  "temperature": 0.3,
  "messages": [
    {"role": "user", "content": "Explain Python decorators simply."}
  ]
}
```

The selected model must already be available to the connected Ollama server.
See the downloaded models through this API:

```bash
curl http://127.0.0.1:8000/api/models
```

Example:

```json
{
  "models": ["llama3.2:1b", "gemma3:4b"]
}
```

## Endpoint reference

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check that the FastAPI process is running |
| `GET` | `/api/models` | List models available in Ollama |
| `POST` | `/api/chat` | Return one complete JSON chat response |
| `POST` | `/api/chat/stream` | Stream the assistant response as plain text |
| `GET` | `/docs` | Open interactive Swagger documentation |

`/health` checks the Python web process only. `/api/models` also contacts
Ollama, so it is a useful connectivity check.

## How the code works

`app/schemas.py` uses Pydantic models to reject malformed requests before they
reach Ollama. For example, `messages` cannot be empty and `temperature` must be
between `0` and `2`.

`app/dependencies.py` creates an asynchronous Ollama client. FastAPI injects
that client into routes, which also makes it easy for the tests to replace it
with a fake.

`app/main.py` converts validated Pydantic messages to dictionaries understood
by Ollama. The normal endpoint awaits a complete result. The streaming endpoint
iterates over Ollama's asynchronous response and yields each piece of content
through FastAPI's `StreamingResponse`.

The API translates common Ollama failures into useful HTTP responses:

- `404` when a requested model is not found;
- `503` when the API cannot connect to Ollama; and
- `502` for other upstream Ollama errors.

## Run the tests

The tests replace Ollama with a small fake client, so they are fast and do not
need the Ollama service or a downloaded model.

```bash
python -m pytest -q
```

Expected result:

```text
5 passed
```

## Troubleshooting

### `Cannot connect to Ollama`

Make sure Ollama is open, or run:

```bash
ollama serve
```

Then check its native API:

```bash
curl http://localhost:11434/api/tags
```

If Ollama runs on another computer or port, set `OLLAMA_HOST` and restart
Uvicorn.

### Model not found

Download the model named in the request:

```bash
ollama pull llama3.2:1b
```

Model names include their tag. `llama3.2:1b` and `llama3.2:3b`, for example,
are different downloads.

### The first response is slow

The first request may need to load the model into memory. Later requests are
usually faster while the model remains loaded. Larger models also need more
RAM or GPU memory and generate text more slowly.

### Port 8000 is already in use

Choose another port:

```bash
uvicorn app.main:app --reload --port 8001
```

### PowerShell changes the curl command

Some Windows PowerShell versions map `curl` to `Invoke-WebRequest`. Use
`curl.exe`, Swagger UI, Postman, or a native `Invoke-RestMethod` command.

## Security and production notes

This repository is a learning project and intentionally has no authentication.
Keep it on your own machine or trusted network. Before exposing it publicly,
add authentication, rate limits, restricted CORS settings, request-size limits,
logging, and a production deployment configuration.

Ollama models can also produce incorrect or unsafe text. Validate model output
before using it for consequential actions.

## Useful resources

- [Ollama Python library](https://github.com/ollama/ollama-python)
- [Ollama chat API documentation](https://docs.ollama.com/api/chat)
- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [Uvicorn documentation](https://www.uvicorn.org/)
- [Original introductory article](https://medium.com/@jonigl/using-ollama-with-python-a-simple-guide-0752369e1e55)

## License

No license has been added yet. Until the repository owner chooses one, the
source remains under the default copyright rules.
