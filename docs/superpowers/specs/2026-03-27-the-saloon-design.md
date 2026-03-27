# The Saloon — Design Spec

**Date:** 2026-03-27
**Status:** Approved

---

## Overview

The Saloon is a local web application where 6 AI agents with distinct personalities hold autonomous, continuous debates on any topic provided by the user. The interface is styled as a pixel-art western saloon (80s aesthetic). The user acts as a moderator, injecting topics and comments at any time. All conversations are saved locally. No external servers or cloud databases.

---

## Goals

- Entertaining, visually immersive debate experience
- 6 agents with strong, distinct personalities that reason and search the web
- Fully local: data stays on the user's machine (SQLite)
- Configurable: LLM provider, search provider, conversation speed
- Multilingual: agents follow the moderator's language automatically

---

## Agents

All agents follow these shared rules:
- Respond in the same language as the moderator's last topic/message
- Keep discussion civil — heated but no insults or offensive language
- Use the `web_search` tool according to their personality and inclinations

| ID | Name | Color | Archetype | Search behavior |
|----|------|-------|-----------|-----------------|
| `prof_quark` | Prof. Isacco Quark | `#88aaff` | The Scientist — rational, evidence-based, academic but accessible. Cites sources, corrects others gently. | Searches actively: arxiv, scientific journals, reputable newspapers. Queries are fact-oriented. |
| `bobby_ray` | Bobby Ray Buster | `#ff6644` | The Redneck — ultra-right American stereotype, beer & BBQ, anti-establishment. Direct, uses slang, occasional 🍺. | Searches selectively: confirms existing beliefs, prefers right-wing sources. |
| `karl_rosso` | Comrade Karl Rosso | `#ff4444` | The Communist — every topic leads back to capitalism as root cause. Ideological, quotes Marx. | Searches for left-wing sources, inequality data, anti-capitalist analyses. |
| `marco_buonsenso` | Marco Buonsenso | `#88cc88` | The Center-Right — moderate conservative, seeks compromise, dislikes extremism. Paternalistic tone. | Searches mainstream Italian/European newspapers, balanced sources. |
| `gigi_bellavita` | Gigi Bellavita | `#ffcc44` | The Simple One — hedonistic, distracted, only interested in food, friends, and fun. Often off-topic. | Rarely searches. Only if topic involves food, travel, or leisure. |
| `zoe_futura` | Zoe Futura | `#ff88cc` | The Young Idealist — angry, well-educated, wants to change the world. Accuses "boomers" regularly. | Searches actively: progressive sources, UN reports, climate/future data. |

### Agent system prompt structure (per agent)

Each system prompt defines:
1. Name, personality, tone of voice
2. Ideological starting position
3. Language rule: *"Always respond in the same language as the moderator's topic or last message."*
4. Search rule: when to search and which sources to prefer
5. Civility rule: *"Keep the discussion heated but civil. No insults, no offensive language."*
6. Context rule: read the conversation history and respond to what others have said

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (React/Vite)                  │
│  ┌─────────────────────────────────┐  ┌───────────────┐ │
│  │   Saloon Scene (pixel-art)      │  │  Settings &   │ │
│  │   + speech bubbles              │  │  History page │ │
│  │   + message log overlay         │  │               │ │
│  └─────────────────────────────────┘  └───────────────┘ │
│              ▲ WebSocket (real-time messages)            │
└──────────────│──────────────────────────────────────────┘
               │
┌──────────────│──────────────────────────────────────────┐
│              │        BACKEND (FastAPI / Python)         │
│  ┌───────────┴──────────┐   ┌──────────────────────────┐│
│  │  WebSocket Manager   │   │   REST API               ││
│  │  (broadcast events)  │   │   /conversations         ││
│  └───────────┬──────────┘   │   /settings              ││
│              │              └──────────────────────────┘│
│  ┌───────────▼───────────────────────────────────────┐  │
│  │              ADK Conversation Engine               │  │
│  │                                                    │  │
│  │  LoopAgent (infinite loop, configurable delay)     │  │
│  │    → agents shuffled randomly each cycle           │  │
│  │    → each agent reads full history from state      │  │
│  │    → each agent may call web_search tool           │  │
│  │    → each response broadcast via WebSocket         │  │
│  │    → each response saved to SQLite                 │  │
│  │                                                    │  │
│  │  Controls: start / pause / resume / set_topic      │  │
│  └───────────────────────────────────────────────────┘  │
│              │                    │                      │
│  ┌───────────▼──────┐  ┌──────────▼──────────────────┐  │
│  │   LiteLLM        │  │   web_search tool            │  │
│  │   Claude /       │  │   Tavily (primary)           │  │
│  │   Gemini /       │  │   DuckDuckGo (fallback)      │  │
│  │   Ollama         │  └──────────────────────────────┘  │
│  └──────────────────┘                                    │
│              │                                           │
│  ┌───────────▼───────────────────────────────────────┐  │
│  │              SQLite (local)                        │  │
│  │  conversations (id, title, topic, llm_provider,    │  │
│  │                 created_at, ended_at)              │  │
│  │  messages (id, conversation_id, agent_id,          │  │
│  │            text, timestamp)                        │  │
│  │  settings (key TEXT PRIMARY KEY, value TEXT)       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### WebSocket event types

```json
{ "type": "message",       "agent": "bobby_ray", "text": "...", "timestamp": "..." }
{ "type": "agent_thinking","agent": "zoe_futura" }
{ "type": "status",        "value": "running" | "paused" | "stopped" }
{ "type": "topic_set",     "topic": "...", "conversation_id": 42 }
```

### Conversation flow

Commands travel via REST. WebSocket is receive-only (server → client events).

1. User submits a topic → FE calls `POST /api/conversations/start { topic }`
2. Backend creates a `conversation` record in SQLite, injects topic into ADK `session.state`, starts LoopAgent
3. Backend broadcasts `{ type: "topic_set", topic, conversation_id }` via WebSocket
4. Each loop iteration: shuffle agent order → execute agents sequentially with `asyncio.sleep(delay)` between each
5. Each agent response: broadcast `{ type: "message", ... }` via WebSocket → save to SQLite
6. Moderator injects a comment → FE calls `POST /api/conversations/inject { text }` → backend writes to `session.state["moderator_input"]`; the **first agent to run** in the next iteration reads it, includes it in their response, then the engine clears it from state so subsequent agents in that same cycle don't re-read it
7. Pause/resume → FE calls `POST /api/conversations/pause` or `/resume`

---

## Frontend

**Stack:** React 18, Vite, TypeScript, Tailwind CSS, Zustand (global state), native WebSocket API.

### Component tree

```
App
├── SaloonPage
│   ├── SaloonScene
│   │   ├── Background        ← pixel-art: floor, bar counter, sign
│   │   ├── Character × 6     ← 32×48px sprite, idle/talking animation
│   │   └── SpeechBubble × 6  ← typewriter effect, auto-dismiss after ~4s
│   ├── MessageLog            ← bottom overlay, last 3-4 messages
│   └── ModeratorInput        ← text field + send button
└── SettingsPage              ← accessible via ⚙️ icon top-right
    ├── ConversationControls  ← Pause / Resume button
    ├── SpeedSlider           ← 5s – 60s delay between agent turns
    ├── LLMSelector           ← provider + model + API key fields
    ├── SearchSelector        ← Tavily / DuckDuckGo + API key
    └── ConversationHistory
        ├── ConversationList
        └── ConversationDetail ← full replay of a past session
```

### Visual design

- **Color palette:**
  - Background: `#0d0500` (warm black)
  - Wood: `#3d1e00` (bar counter, floor)
  - Gold: `#f0c060` (sign, accents, input border)
  - Text: `#e8d8b0` (parchment color)
- **Character sprites:** SVG/CSS, 32×48px, pixel-art style, 2 animation frames (idle: slow breathing, talking: mouth movement + slight bounce)
- **Speech bubble:** appears above the active character, typewriter text effect, dissolves after ~4 seconds. Updates in place if same agent speaks again before dismissal.
- **Message log:** semi-transparent overlay at the bottom of the scene, shows last 3-4 messages with agent name in their color.
- **Topic display:** current topic shown as a "wanted poster" or saloon sign element in the scene header.
- **Navigation:** single ⚙️ icon top-right for Settings. No traditional navbar to preserve the atmosphere.
- **Agent profile cards:** clickable on each character sprite to show a modal with the agent's name, personality description, and ideology.

---

## Backend

**Stack:** Python 3.11+, FastAPI, uvicorn, google-adk, litellm, aiosqlite, tavily-python, duckduckgo-search.

### File structure

```
backend/
├── main.py           ← FastAPI app, WebSocket endpoint, REST routes
├── config.py         ← loads .env + runtime settings from SQLite
├── database.py       ← SQLite schema, async CRUD (aiosqlite)
├── engine.py         ← ConversationEngine: wraps ADK LoopAgent
├── agents/
│   ├── factory.py    ← builds 6 LlmAgent instances via LiteLLM
│   ├── personas.py   ← system prompts for all 6 agents
│   └── search_tool.py← web_search(query) → Tavily or DuckDuckGo
└── requirements.txt
```

### LiteLLM model strings

```python
PROVIDER_MODELS = {
    "claude":  "anthropic/claude-sonnet-4-6",
    "gemini":  "gemini/gemini-2.5-flash",
    "ollama":  "ollama/{model}",  # model from OLLAMA_MODEL env var
}
```

### ConversationEngine (engine.py)

```python
class ConversationEngine:
    async def start(self, topic: str) -> int         # returns conversation_id
    async def pause(self)
    async def resume(self)
    async def inject(self, moderator_text: str)      # injects moderator comment
    async def stop(self)
```

Internally uses an ADK `InMemorySessionService` per conversation. The LoopAgent sub-agents are shuffled at runtime each iteration using a custom `BaseAgent` wrapper that randomizes the execution order before delegating to each `LlmAgent`.

### REST API

```
POST   /api/conversations/start     { topic }    → { conversation_id }
POST   /api/conversations/pause
POST   /api/conversations/resume
POST   /api/conversations/inject    { text }
GET    /api/conversations           → list of past conversations
GET    /api/conversations/{id}      → full message history
GET    /api/settings                → current settings
PUT    /api/settings                { key, value }
WS     /ws                          → real-time event stream
```

---

## Configuration & Settings

### Environment variables (.env)

```env
# LLM Provider
LLM_PROVIDER=claude              # claude | gemini | ollama
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Search Provider
SEARCH_PROVIDER=tavily           # tavily | duckduckgo
TAVILY_API_KEY=tvly-...

# Conversation defaults
CONVERSATION_DELAY_SECONDS=20    # delay between agent turns
```

Settings are also editable at runtime via the Settings page and persisted in the `settings` SQLite table. Runtime settings override `.env` values.

---

## Database (SQLite, local)

File: `backend/the_saloon.db`

```sql
CREATE TABLE conversations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT,               -- auto-generated from topic
    topic        TEXT NOT NULL,
    llm_provider TEXT NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at     DATETIME
);

CREATE TABLE messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    agent_id        TEXT NOT NULL,   -- e.g. "bobby_ray"
    text            TEXT NOT NULL,
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## Out of Scope

- User authentication (single-user local app)
- Mobile layout optimization
- Voice/audio output
- Agent memory across conversations (each conversation starts fresh)
- Real-time collaboration (multi-user)
