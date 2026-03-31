# The Saloon — CLAUDE.md

## What this is

A local web app where 6 AI agents with distinct personalities debate endlessly on any topic. Pixel-art western saloon aesthetic. The user acts as moderator. No cloud, no auth — everything local.

## Architecture

```
frontend/    React 18 + Vite + TypeScript + Tailwind + Zustand
backend/     FastAPI + Python 3.11+ + Google ADK + LiteLLM + SQLite
```

- **Frontend** talks to backend via REST (commands) and SSE (receive-only stream of events)
- **Backend** runs an infinite asyncio loop (`ConversationEngine`) that shuffles and runs 6 ADK `LlmAgent` instances each cycle
- **SSE** (`/events`) is server → client only. All commands (start, pause, resume, inject) go through REST
- **SQLite** at `backend/the_saloon.db` stores conversations, messages, settings

## Key files

```
backend/
  main.py          FastAPI app, WebSocket manager, REST routes, lifespan
  engine.py        ConversationEngine — asyncio loop, pause/resume, inject
  database.py      SQLite CRUD via aiosqlite
  config.py        Settings with DB-overrides-.env chain
  agents/
    personas.py    6 system prompts (AGENT_PERSONAS dict)
    factory.py     build_agents() → list[LlmAgent] via LiteLlm
    search_tool.py make_search_tool() → web_search() for Tavily or DuckDuckGo

frontend/src/
  types.ts         Shared types: AgentId, AGENTS, WsEvent, ChatMessage, etc.
  store/saloonStore.ts   Zustand store: messages, status, thinkingAgent, topic
  hooks/useEventSource.ts  SSE auto-reconnect hook → dispatches into store
  hooks/useTTS.ts          Text-to-speech hook (speak/stop)
  api/client.ts    REST helpers
  components/
    SaloonPage.tsx   Root: scene + log + input
    SaloonScene.tsx  6 characters positioned along the bar
    Character.tsx    Pixel sprite + speech bubble + profile modal
    Background.tsx   SVG pixel-art saloon interior
    SpeechBubble.tsx Typewriter effect, 5s auto-dismiss
    MessageLog.tsx   Last 4 messages overlay
    ModeratorInput.tsx  START / INJECT / pause / ⚙️
    SettingsPage.tsx Config + history tabs
```

## Running locally

```bash
# Backend
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev
# → http://localhost:5173
```

Copy `.env.example` to `.env` and fill in `ANTHROPIC_API_KEY` and `TAVILY_API_KEY` before starting.

## Tests

```bash
cd backend
source .venv/bin/activate
pytest -v          # 35 tests across 6 modules
```

Frontend has no automated tests — TypeScript check serves as the baseline:

```bash
cd frontend
npx tsc --noEmit
npm run build      # production build check
```

## Environment variables

See `.env.example`. Key settings:

| Variable | Default | Notes |
|----------|---------|-------|
| `LLM_PROVIDER` | `claude` | claude / gemini / ollama |
| `ANTHROPIC_API_KEY` | — | Required for Claude |
| `GOOGLE_API_KEY` | — | Required for Gemini |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama only |
| `OLLAMA_MODEL` | `llama3.2` | Ollama only |
| `SEARCH_PROVIDER` | `tavily` | tavily / duckduckgo |
| `TAVILY_API_KEY` | — | Required for Tavily |
| `CONVERSATION_DELAY_SECONDS` | `8` | Delay between agent turns |

All settings can be overridden at runtime via the Settings page (stored in SQLite, take precedence over `.env`).

## The 6 agents

| ID | Name | Color | Archetype |
|----|------|-------|-----------|
| `prof_quark` | Prof. Isacco Quark | `#88aaff` | The Scientist |
| `bobby_ray` | Bobby Ray Buster | `#ff6644` | The Redneck |
| `karl_rosso` | Comrade Karl Rosso | `#ff4444` | The Communist |
| `charles_pemberton` | Charles Pemberton | `#88cc88` | The Center-Right |
| `gigi_bellavita` | Gigi Bellavita | `#ffcc44` | The Simple One |
| `zoe_futura` | Zoe Futura | `#ff88cc` | The Young Idealist |

Agents respond in the moderator's language (follow-the-moderator language rule in `SHARED_RULES` in `personas.py`).

## ConversationEngine internals

- Each cycle: agents are shuffled randomly, then run sequentially via `_run_one_agent()`
- Each agent call creates a **fresh** `InMemoryRunner` — ADK session history is NOT used. Conversation history is passed as a formatted string in `session.state["conversation_history"]`
- Moderator input (`inject()`) is consumed by the **first agent** of the next cycle, then immediately cleared (cleared synchronously before any `await` to avoid race conditions)
- Failed agent calls are silently skipped (no error bubbles in the UI)
- Pause/resume: `asyncio.Event` — `clear()` to pause, `set()` to resume
- **[SKIP] mechanic**: Agents can reply `[SKIP]` when they have nothing relevant to add. The engine detects this, clears the `agent_thinking` indicator, skips the delay, and moves on. This makes the debate feel more natural — not every agent speaks every round. Moderator input always suppresses skip.

## SSE events (server → client, `GET /events`)

```json
{ "type": "message",       "agent": "bobby_ray", "agent_name": "Bobby Ray Buster", "text": "...", "timestamp": "..." }
{ "type": "agent_thinking","agent": "zoe_futura" }   // agent: null clears the thinking indicator (skip/error)
{ "type": "status",        "value": "running" | "paused" | "stopped" }
{ "type": "topic_set",     "topic": "...", "conversation_id": 42 }
```

## REST API

```
POST /api/conversations/start    { topic }  → { conversation_id }
POST /api/conversations/stop
POST /api/conversations/pause
POST /api/conversations/resume
POST /api/conversations/inject   { text }
GET  /api/conversations          → list
GET  /api/conversations/{id}     → { conversation, messages }
DELETE /api/conversations/{id}   → { status: "deleted" }
GET  /api/settings               → { llm_provider, search_provider, ... }
PUT  /api/settings               { key, value }   key must match ^[A-Za-z][A-Za-z0-9_]*$
GET  /api/health                 → { status: "ok" }
GET  /events                     → SSE stream (text/event-stream)
```

## Design decisions and non-obvious choices

- **LiteLLM over native ADK model**: ADK's `google_search` grounding only works with Gemini. LiteLLM via `LiteLlm(model="anthropic/...")` makes all providers work uniformly with a custom Tavily/DuckDuckGo tool.
- **Fresh runner per agent call**: Rather than accumulating ADK session history (which would hit context limits), each turn creates a fresh `InMemoryRunner` and injects history as a plain-text string in session state.
- **Moderator input cleared synchronously**: The `_moderator_input` field is cleared immediately when captured at cycle start (before any `await`) to prevent concurrent `inject()` calls from losing messages.
- **Settings key validation**: `PUT /api/settings` validates key against `^[A-Za-z][A-Za-z0-9_]*$` to prevent arbitrary key injection.
- **Version pins relaxed**: `fastapi`, `uvicorn`, `litellm`, `anthropic`, `httpx` use `>=` bounds in `requirements.txt` because `google-adk==1.4.2` requires `starlette>=0.46.2`, incompatible with fastapi `0.115.0`'s starlette requirement.
- **LangGraph considered and rejected (for now)**: LangGraph would enable dynamic turn-taking (agents choosing who speaks next). Rejected in favour of the simpler `[SKIP]` mechanic — same effect, no new dependency. Revisit if routing needs become more complex (e.g. agent-to-agent addressing, branching debates).
- **Ollama tool-calling disabled**: Local models (ollama/*) hallucinate tool call names not in the schema. Tools are disabled entirely for Ollama providers. Claude/Gemini keep web search.
