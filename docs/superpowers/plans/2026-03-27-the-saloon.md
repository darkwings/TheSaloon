# The Saloon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app where 6 AI agents with distinct personalities debate autonomously in a pixel-art western saloon, driven by Google ADK + LiteLLM, with a React frontend and SQLite persistence.

**Architecture:** FastAPI backend runs a `ConversationEngine` that loops indefinitely — each iteration shuffles 6 ADK `LlmAgent` instances and runs them sequentially, passing conversation history via session state. Each agent response is broadcast over WebSocket to the React frontend, which renders it as a speech bubble above the matching pixel-art character. All data (conversations, messages, settings) is stored locally in SQLite.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, google-adk, litellm, aiosqlite, tavily-python, duckduckgo-search, pytest, pytest-asyncio — React 18, Vite, TypeScript, Tailwind CSS, Zustand.

---

## File Map

```
the-saloon/
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── main.py                  # FastAPI app: WebSocket manager, REST routes
│   ├── config.py                # Settings: .env → SQLite override chain
│   ├── database.py              # SQLite schema + async CRUD via aiosqlite
│   ├── engine.py                # ConversationEngine: asyncio loop + ADK agents
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── personas.py          # 6 system prompts (one per agent)
│   │   ├── search_tool.py       # web_search() → Tavily or DuckDuckGo
│   │   └── factory.py           # build_agents() → list[LlmAgent] via LiteLlm
│   ├── pytest.ini
│   ├── requirements.txt
│   └── tests/
│       ├── test_database.py
│       ├── test_config.py
│       ├── test_search_tool.py
│       ├── test_factory.py
│       ├── test_engine.py
│       └── test_api.py
└── frontend/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types.ts              # Shared TS types (WsEvent, Agent, Conversation…)
        ├── api/
        │   └── client.ts         # REST calls to FastAPI
        ├── store/
        │   └── saloonStore.ts    # Zustand: messages, status, settings
        ├── hooks/
        │   └── useWebSocket.ts   # WS connection, reconnect, dispatch to store
        └── components/
            ├── SaloonPage.tsx    # Root layout: scene + input
            ├── SaloonScene.tsx   # Positions Background + 6 Characters
            ├── Background.tsx    # SVG pixel-art: floor, bar, sign, lighting
            ├── Character.tsx     # Sprite + SpeechBubble for one agent
            ├── SpeechBubble.tsx  # Typewriter text, auto-dismiss
            ├── MessageLog.tsx    # Bottom overlay: last 4 messages
            ├── ModeratorInput.tsx# Text field + send → POST /api/conversations/*
            └── SettingsPage.tsx  # Full settings: LLM, search, speed, history
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/agents/__init__.py`

- [ ] **Step 1.1: Create .gitignore**

```
# Python
__pycache__/
*.pyc
*.pyo
.venv/
venv/
*.egg-info/
.pytest_cache/

# Env
.env

# DB
backend/the_saloon.db

# Frontend
frontend/node_modules/
frontend/dist/

# Brainstorm
.superpowers/
```

- [ ] **Step 1.2: Create .env.example**

```env
# LLM Provider: claude | gemini | ollama
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Search Provider: tavily | duckduckgo
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=tvly-...

# Conversation
CONVERSATION_DELAY_SECONDS=20
```

- [ ] **Step 1.3: Create backend/requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
python-dotenv==1.0.1
aiosqlite==0.20.0
google-adk==1.4.2
litellm==1.52.0
anthropic==0.40.0
google-generativeai==0.8.3
tavily-python==0.5.0
duckduckgo-search==6.3.7
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
```

- [ ] **Step 1.4: Create backend/pytest.ini**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] **Step 1.5: Create backend/agents/__init__.py** (empty file)

```python
```

- [ ] **Step 1.6: Install backend dependencies**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Expected: long install output ending with `Successfully installed ...`

- [ ] **Step 1.7: Commit**

```bash
git add .gitignore .env.example backend/requirements.txt backend/pytest.ini backend/agents/__init__.py
git commit -m "chore: project scaffold, dependencies, .env template"
```

---

## Task 2: Database Layer

**Files:**
- Create: `backend/database.py`
- Create: `backend/tests/test_database.py`

- [ ] **Step 2.1: Write failing tests**

```python
# backend/tests/test_database.py
import pytest
import aiosqlite
from database import Database

@pytest.fixture
async def db(tmp_path):
    d = Database(str(tmp_path / "test.db"))
    await d.init()
    yield d
    await d.close()

async def test_create_conversation(db):
    conv_id = await db.create_conversation(
        topic="Climate change", llm_provider="claude"
    )
    assert isinstance(conv_id, int)
    assert conv_id > 0

async def test_list_conversations_empty(db):
    result = await db.list_conversations()
    assert result == []

async def test_list_conversations_after_create(db):
    await db.create_conversation(topic="AI ethics", llm_provider="gemini")
    result = await db.list_conversations()
    assert len(result) == 1
    assert result[0]["topic"] == "AI ethics"

async def test_save_and_get_messages(db):
    conv_id = await db.create_conversation(topic="Test", llm_provider="claude")
    await db.save_message(conv_id, agent_id="prof_quark", text="Hello world")
    messages = await db.get_messages(conv_id)
    assert len(messages) == 1
    assert messages[0]["agent_id"] == "prof_quark"
    assert messages[0]["text"] == "Hello world"

async def test_get_setting_default(db):
    value = await db.get_setting("delay", default="20")
    assert value == "20"

async def test_set_and_get_setting(db):
    await db.set_setting("delay", "30")
    value = await db.get_setting("delay", default="20")
    assert value == "30"

async def test_end_conversation(db):
    conv_id = await db.create_conversation(topic="Test", llm_provider="claude")
    await db.end_conversation(conv_id)
    result = await db.list_conversations()
    assert result[0]["ended_at"] is not None
```

- [ ] **Step 2.2: Run tests — verify they fail**

```bash
cd backend
pytest tests/test_database.py -v
```

Expected: `ModuleNotFoundError: No module named 'database'`

- [ ] **Step 2.3: Implement database.py**

```python
# backend/database.py
import aiosqlite
from datetime import datetime
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT,
    topic        TEXT NOT NULL,
    llm_provider TEXT NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at     DATETIME
);
CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    agent_id        TEXT NOT NULL,
    text            TEXT NOT NULL,
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

class Database:
    def __init__(self, path: str = "the_saloon.db"):
        self.path = path
        self._conn: aiosqlite.Connection | None = None

    async def init(self):
        self._conn = await aiosqlite.connect(self.path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.executescript(SCHEMA)
        await self._conn.commit()

    async def close(self):
        if self._conn:
            await self._conn.close()

    async def create_conversation(self, topic: str, llm_provider: str) -> int:
        title = topic[:60] + ("…" if len(topic) > 60 else "")
        async with self._conn.execute(
            "INSERT INTO conversations (title, topic, llm_provider) VALUES (?, ?, ?)",
            (title, topic, llm_provider),
        ) as cursor:
            await self._conn.commit()
            return cursor.lastrowid

    async def end_conversation(self, conv_id: int):
        await self._conn.execute(
            "UPDATE conversations SET ended_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), conv_id),
        )
        await self._conn.commit()

    async def list_conversations(self) -> list[dict]:
        async with self._conn.execute(
            "SELECT * FROM conversations ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_conversation(self, conv_id: int) -> dict | None:
        async with self._conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (conv_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def save_message(self, conv_id: int, agent_id: str, text: str):
        await self._conn.execute(
            "INSERT INTO messages (conversation_id, agent_id, text) VALUES (?, ?, ?)",
            (conv_id, agent_id, text),
        )
        await self._conn.commit()

    async def get_messages(self, conv_id: int) -> list[dict]:
        async with self._conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp",
            (conv_id,),
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_setting(self, key: str, default: Any = None) -> Any:
        async with self._conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ) as cursor:
            row = await cursor.fetchone()
            return row["value"] if row else default

    async def set_setting(self, key: str, value: str):
        await self._conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        await self._conn.commit()
```

- [ ] **Step 2.4: Run tests — verify they pass**

```bash
pytest tests/test_database.py -v
```

Expected: `6 passed`

- [ ] **Step 2.5: Commit**

```bash
git add backend/database.py backend/tests/test_database.py
git commit -m "feat: database layer (SQLite via aiosqlite)"
```

---

## Task 3: Config System

**Files:**
- Create: `backend/config.py`
- Create: `backend/tests/test_config.py`

- [ ] **Step 3.1: Write failing tests**

```python
# backend/tests/test_config.py
import pytest
import os
from unittest.mock import AsyncMock, patch
from config import Settings

async def test_get_llm_provider_from_env():
    with patch.dict(os.environ, {"LLM_PROVIDER": "gemini"}):
        s = Settings(db=AsyncMock())
        provider = await s.get("LLM_PROVIDER")
        assert provider == "gemini"

async def test_db_overrides_env():
    mock_db = AsyncMock()
    mock_db.get_setting = AsyncMock(return_value="ollama")
    with patch.dict(os.environ, {"LLM_PROVIDER": "claude"}):
        s = Settings(db=mock_db)
        value = await s.get("LLM_PROVIDER")
        assert value == "ollama"

async def test_env_fallback_when_db_returns_none():
    mock_db = AsyncMock()
    mock_db.get_setting = AsyncMock(return_value=None)
    with patch.dict(os.environ, {"LLM_PROVIDER": "claude"}):
        s = Settings(db=mock_db)
        value = await s.get("LLM_PROVIDER")
        assert value == "claude"

async def test_default_when_missing_everywhere():
    mock_db = AsyncMock()
    mock_db.get_setting = AsyncMock(return_value=None)
    with patch.dict(os.environ, {}, clear=True):
        s = Settings(db=mock_db)
        value = await s.get("MISSING_KEY", default="fallback")
        assert value == "fallback"

async def test_model_string_claude():
    mock_db = AsyncMock()
    mock_db.get_setting = AsyncMock(return_value=None)
    with patch.dict(os.environ, {"LLM_PROVIDER": "claude"}):
        s = Settings(db=mock_db)
        model = await s.get_model_string()
        assert model == "anthropic/claude-sonnet-4-6"

async def test_model_string_gemini():
    mock_db = AsyncMock()
    mock_db.get_setting = AsyncMock(return_value=None)
    with patch.dict(os.environ, {"LLM_PROVIDER": "gemini"}):
        s = Settings(db=mock_db)
        model = await s.get_model_string()
        assert model == "gemini/gemini-2.5-flash"

async def test_model_string_ollama():
    mock_db = AsyncMock()
    mock_db.get_setting = AsyncMock(return_value=None)
    with patch.dict(os.environ, {"LLM_PROVIDER": "ollama", "OLLAMA_MODEL": "llama3.2"}):
        s = Settings(db=mock_db)
        model = await s.get_model_string()
        assert model == "ollama/llama3.2"
```

- [ ] **Step 3.2: Run tests — verify they fail**

```bash
pytest tests/test_config.py -v
```

Expected: `ModuleNotFoundError: No module named 'config'`

- [ ] **Step 3.3: Implement config.py**

```python
# backend/config.py
import os
from dotenv import load_dotenv

load_dotenv()

PROVIDER_MODELS = {
    "claude": "anthropic/claude-sonnet-4-6",
    "gemini": "gemini/gemini-2.5-flash",
    "ollama": "ollama/{model}",
}

class Settings:
    def __init__(self, db):
        self._db = db

    async def get(self, key: str, default: str | None = None) -> str | None:
        """DB value overrides .env. Returns default if neither exists."""
        db_value = await self._db.get_setting(key)
        if db_value is not None:
            return db_value
        return os.getenv(key, default)

    async def get_model_string(self) -> str:
        provider = await self.get("LLM_PROVIDER", default="claude")
        template = PROVIDER_MODELS.get(provider, PROVIDER_MODELS["claude"])
        if provider == "ollama":
            model_name = await self.get("OLLAMA_MODEL", default="llama3.2")
            return template.format(model=model_name)
        return template

    async def get_delay(self) -> int:
        val = await self.get("CONVERSATION_DELAY_SECONDS", default="20")
        return int(val)

    async def get_search_provider(self) -> str:
        return await self.get("SEARCH_PROVIDER", default="tavily")
```

- [ ] **Step 3.4: Run tests — verify they pass**

```bash
pytest tests/test_config.py -v
```

Expected: `7 passed`

- [ ] **Step 3.5: Commit**

```bash
git add backend/config.py backend/tests/test_config.py
git commit -m "feat: config system with DB override chain"
```

---

## Task 4: Search Tool

**Files:**
- Create: `backend/agents/search_tool.py`
- Create: `backend/tests/test_search_tool.py`

- [ ] **Step 4.1: Write failing tests**

```python
# backend/tests/test_search_tool.py
import pytest
from unittest.mock import patch, MagicMock
from agents.search_tool import make_search_tool

def test_make_search_tool_returns_callable():
    tool = make_search_tool(provider="duckduckgo", api_key=None)
    assert callable(tool)

def test_tool_has_correct_docstring():
    tool = make_search_tool(provider="tavily", api_key="fake")
    assert "Search the web" in tool.__doc__

def test_duckduckgo_search_returns_string():
    mock_results = [
        {"title": "Result 1", "body": "Some content", "href": "https://example.com"}
    ]
    with patch("agents.search_tool.DDGS") as MockDDGS:
        instance = MockDDGS.return_value.__enter__.return_value
        instance.text.return_value = mock_results
        tool = make_search_tool(provider="duckduckgo", api_key=None)
        result = tool("climate change")
        assert "Result 1" in result
        assert "Some content" in result

def test_tavily_search_returns_string():
    mock_response = {
        "results": [
            {"title": "Arxiv Paper", "content": "Important findings", "url": "https://arxiv.org/1"}
        ]
    }
    with patch("agents.search_tool.TavilyClient") as MockTavily:
        instance = MockTavily.return_value
        instance.search.return_value = mock_response
        tool = make_search_tool(provider="tavily", api_key="fake-key")
        result = tool("quantum physics")
        assert "Arxiv Paper" in result
        assert "Important findings" in result

def test_search_handles_empty_results():
    with patch("agents.search_tool.DDGS") as MockDDGS:
        instance = MockDDGS.return_value.__enter__.return_value
        instance.text.return_value = []
        tool = make_search_tool(provider="duckduckgo", api_key=None)
        result = tool("obscure query")
        assert isinstance(result, str)
        assert "No results" in result
```

- [ ] **Step 4.2: Run tests — verify they fail**

```bash
pytest tests/test_search_tool.py -v
```

Expected: `ModuleNotFoundError: No module named 'agents.search_tool'`

- [ ] **Step 4.3: Implement agents/search_tool.py**

```python
# backend/agents/search_tool.py
from typing import Callable

def make_search_tool(provider: str, api_key: str | None) -> Callable[[str], str]:
    """Factory that returns a web_search function bound to the chosen provider."""

    if provider == "tavily":
        from tavily import TavilyClient
        client = TavilyClient(api_key=api_key)

        def web_search(query: str) -> str:
            """Search the web for current information on a topic.

            Args:
                query: The search query string.

            Returns:
                A string containing the top search results with titles, content, and URLs.
            """
            try:
                response = client.search(query, max_results=3)
                results = response.get("results", [])
                if not results:
                    return "No results found for this query."
                parts = []
                for r in results:
                    parts.append(f"[{r['title']}]\n{r['content']}\n{r['url']}")
                return "\n\n".join(parts)
            except Exception as e:
                return f"Search error: {str(e)}"

    else:  # duckduckgo
        from duckduckgo_search import DDGS

        def web_search(query: str) -> str:
            """Search the web for current information on a topic.

            Args:
                query: The search query string.

            Returns:
                A string containing the top search results with titles, snippets, and URLs.
            """
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(query, max_results=3))
                if not results:
                    return "No results found for this query."
                parts = []
                for r in results:
                    parts.append(f"[{r['title']}]\n{r['body']}\n{r['href']}")
                return "\n\n".join(parts)
            except Exception as e:
                return f"Search error: {str(e)}"

    return web_search
```

- [ ] **Step 4.4: Run tests — verify they pass**

```bash
pytest tests/test_search_tool.py -v
```

Expected: `5 passed`

- [ ] **Step 4.5: Commit**

```bash
git add backend/agents/search_tool.py backend/tests/test_search_tool.py
git commit -m "feat: search tool abstraction (Tavily/DuckDuckGo)"
```

---

## Task 5: Agent Personas & Factory

**Files:**
- Create: `backend/agents/personas.py`
- Create: `backend/agents/factory.py`
- Create: `backend/tests/test_factory.py`

- [ ] **Step 5.1: Create agents/personas.py**

```python
# backend/agents/personas.py

SHARED_RULES = """
LANGUAGE RULE: Always respond in the exact same language used by the moderator in their topic or latest message. If the moderator writes in Italian, respond in Italian. If in English, respond in English.

CIVILITY RULE: Keep the discussion passionate but civil. No insults, no offensive language, no slurs. You can be blunt, sarcastic, or combative in ideas — but never personal attacks.

BREVITY RULE: Keep your response to 2-4 sentences maximum. This is a bar conversation, not a lecture.

CONTEXT RULE: Always read the conversation history and respond to what others have actually said. Don't repeat yourself. React, challenge, agree, or mock — but stay engaged with the thread.
"""

AGENT_PERSONAS = {
    "prof_quark": {
        "name": "Prof. Isacco Quark",
        "color": "#88aaff",
        "archetype": "The Scientist",
        "description": "Rational, evidence-based, academic but accessible. Corrects others gently with data.",
        "instruction": f"""You are Prof. Isacco Quark, a scientist and intellectual. You are deeply committed to the scientific method and empirical evidence. You find conspiracy theories mildly amusing. You cite sources when possible. You are polite but firm when correcting factual errors. You occasionally get excited about the elegance of data.

SEARCH BEHAVIOR: You actively use web_search to find scientific evidence, peer-reviewed studies, arxiv papers, and reputable news sources. You prefer fact-based queries. Always cite what you find.

Current topic: {{topic}}

Conversation history:
{{conversation_history}}

Moderator's latest input: {{moderator_input}}

{SHARED_RULES}
Respond as Prof. Isacco Quark.""",
    },
    "bobby_ray": {
        "name": "Bobby Ray Buster",
        "color": "#ff6644",
        "archetype": "The Redneck",
        "description": "Ultra-right American stereotype. Beer, BBQ, anti-establishment. 🍺",
        "instruction": f"""You are Bobby Ray Buster, a proud American from the deep south. You love beer, BBQ, pickup trucks, and your constitutional rights. You are deeply skeptical of the government, mainstream media, scientists, and anyone who uses the word "privilege." You have strong opinions and aren't afraid to share them loudly. You occasionally insert 🍺 or "buddy" into your messages.

SEARCH BEHAVIOR: You sometimes use web_search but ONLY to find sources that confirm what you already believe. You trust right-leaning news and dismiss anything from mainstream media as "fake news."

Current topic: {{topic}}

Conversation history:
{{conversation_history}}

Moderator's latest input: {{moderator_input}}

{SHARED_RULES}
Respond as Bobby Ray Buster.""",
    },
    "karl_rosso": {
        "name": "Comrade Karl Rosso",
        "color": "#ff4444",
        "archetype": "The Communist",
        "description": "Every topic leads back to capitalism as root cause. Quotes Marx.",
        "instruction": f"""You are Comrade Karl Rosso, a committed Marxist intellectual. Everything — literally everything — can be explained through the lens of class struggle and capitalist exploitation. You quote Marx, Engels, Gramsci, and occasionally Lenin. You find the other participants hopelessly trapped in bourgeois false consciousness. You are passionate, slightly pedantic, and convinced you are the only one who truly understands the historical dialectic.

SEARCH BEHAVIOR: You use web_search to find data on inequality, workers' rights, anti-capitalist analyses, and left-wing economic research. You prefer academic Marxist sources and progressive media.

Current topic: {{topic}}

Conversation history:
{{conversation_history}}

Moderator's latest input: {{moderator_input}}

{SHARED_RULES}
Respond as Comrade Karl Rosso.""",
    },
    "marco_buonsenso": {
        "name": "Marco Buonsenso",
        "color": "#88cc88",
        "archetype": "The Center-Right",
        "description": "Moderate conservative, seeks compromise, dislikes extremism. Slightly paternalistic.",
        "instruction": f"""You are Marco Buonsenso, a moderate center-right professional. You believe in tradition, measured reform, free markets with sensible regulation, and the importance of institutions. You find both Karl and Bobby exhausting in their own ways. You consider yourself the voice of reason and practical wisdom. You sometimes sound slightly patronizing toward the others, especially the younger ones.

SEARCH BEHAVIOR: You use web_search to find data from mainstream Italian and European newspapers, centrist think tanks, and economic reports. You prefer balanced, credible sources.

Current topic: {{topic}}

Conversation history:
{{conversation_history}}

Moderator's latest input: {{moderator_input}}

{SHARED_RULES}
Respond as Marco Buonsenso.""",
    },
    "gigi_bellavita": {
        "name": "Gigi Bellavita",
        "color": "#ffcc44",
        "archetype": "The Simple One",
        "description": "Hedonistic, distracted, only cares about food, friends and fun. Often off-topic.",
        "instruction": f"""You are Gigi Bellavita, an easy-going person whose main interests are good food, cold beer, weekend trips, and hanging out with friends. You are not particularly political or ideological. Complex debates tire you quickly. You often change the subject to something more enjoyable. You are friendly and genuinely likeable, just not very engaged with the world's problems. You sometimes wonder aloud if there's pizza nearby.

SEARCH BEHAVIOR: You almost never use web_search. The only exception is if the topic is directly about food, travel, restaurants, local events, or leisure. Even then, only sometimes.

Current topic: {{topic}}

Conversation history:
{{conversation_history}}

Moderator's latest input: {{moderator_input}}

{SHARED_RULES}
Respond as Gigi Bellavita.""",
    },
    "zoe_futura": {
        "name": "Zoe Futura",
        "color": "#ff88cc",
        "archetype": "The Young Idealist",
        "description": "Angry, well-educated, wants to change the world. Accuses boomers regularly.",
        "instruction": f"""You are Zoe Futura, a 24-year-old activist and university graduate drowning in student debt while watching older generations ignore the climate crisis, housing affordability, and systemic inequality. You are well-read, articulate, and genuinely angry. You frequently point out that older generations are mortgaging the future. You use terms like "systemic," "intersectional," and "accountability." You respect Prof. Quark's data but wish more people actually listened to scientists.

SEARCH BEHAVIOR: You actively use web_search to find recent reports from the UN, NGOs, academic institutions, and progressive media on climate, inequality, housing, and youth issues. You love finding hard data to back up your points.

Current topic: {{topic}}

Conversation history:
{{conversation_history}}

Moderator's latest input: {{moderator_input}}

{SHARED_RULES}
Respond as Zoe Futura.""",
    },
}
```

- [ ] **Step 5.2: Write failing tests for factory**

```python
# backend/tests/test_factory.py
import pytest
from unittest.mock import patch, MagicMock
from agents.factory import build_agents
from agents.personas import AGENT_PERSONAS

def make_mock_search_tool():
    def web_search(query: str) -> str:
        """Search the web for current information."""
        return f"Results for: {query}"
    return web_search

def test_build_agents_returns_six():
    with patch("agents.factory.LlmAgent") as MockAgent, \
         patch("agents.factory.LiteLlm") as MockLiteLlm:
        MockAgent.return_value = MagicMock()
        agents = build_agents(
            model_string="anthropic/claude-sonnet-4-6",
            search_tool=make_mock_search_tool(),
        )
        assert len(agents) == 6

def test_build_agents_uses_all_personas():
    with patch("agents.factory.LlmAgent") as MockAgent, \
         patch("agents.factory.LiteLlm") as MockLiteLlm:
        MockAgent.return_value = MagicMock()
        agents = build_agents(
            model_string="anthropic/claude-sonnet-4-6",
            search_tool=make_mock_search_tool(),
        )
        created_names = [call.kwargs["name"] for call in MockAgent.call_args_list]
        for agent_id in AGENT_PERSONAS:
            assert agent_id in created_names

def test_build_agents_includes_search_tool():
    with patch("agents.factory.LlmAgent") as MockAgent, \
         patch("agents.factory.LiteLlm") as MockLiteLlm:
        MockAgent.return_value = MagicMock()
        search_tool = make_mock_search_tool()
        build_agents(
            model_string="anthropic/claude-sonnet-4-6",
            search_tool=search_tool,
        )
        for call in MockAgent.call_args_list:
            tools = call.kwargs.get("tools", [])
            assert search_tool in tools
```

- [ ] **Step 5.3: Run tests — verify they fail**

```bash
pytest tests/test_factory.py -v
```

Expected: `ModuleNotFoundError: No module named 'agents.factory'`

- [ ] **Step 5.4: Implement agents/factory.py**

```python
# backend/agents/factory.py
from typing import Callable
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from agents.personas import AGENT_PERSONAS

def build_agents(model_string: str, search_tool: Callable) -> list[LlmAgent]:
    """Build all 6 LlmAgent instances with the given model and search tool."""
    agents = []
    for agent_id, persona in AGENT_PERSONAS.items():
        agent = LlmAgent(
            name=agent_id,
            model=LiteLlm(model=model_string),
            instruction=persona["instruction"],
            description=persona["description"],
            tools=[search_tool],
        )
        agents.append(agent)
    return agents
```

- [ ] **Step 5.5: Run tests — verify they pass**

```bash
pytest tests/test_factory.py -v
```

Expected: `3 passed`

- [ ] **Step 5.6: Commit**

```bash
git add backend/agents/personas.py backend/agents/factory.py backend/tests/test_factory.py
git commit -m "feat: agent personas (6 system prompts) and factory"
```

---

## Task 6: Conversation Engine

**Files:**
- Create: `backend/engine.py`
- Create: `backend/tests/test_engine.py`

**How it works:** The engine keeps an asyncio `Task` running the debate loop. Each iteration: shuffle the 6 agents → for each agent, create a fresh ADK `InMemoryRunner` + session, inject `topic`, `conversation_history` (last 20 messages formatted as text), and `moderator_input` into session state, call `runner.run_async()`, extract the final text response, broadcast via WebSocket, save to DB. Between agents: `asyncio.sleep(delay)`. Pause/resume is controlled by an `asyncio.Event`.

- [ ] **Step 6.1: Write failing tests**

```python
# backend/tests/test_engine.py
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from engine import ConversationEngine

def make_mock_agent(agent_id: str, response_text: str):
    agent = MagicMock()
    agent.name = agent_id
    return agent

def make_mock_db(conv_id: int = 1):
    db = AsyncMock()
    db.create_conversation = AsyncMock(return_value=conv_id)
    db.save_message = AsyncMock()
    db.end_conversation = AsyncMock()
    return db

async def test_engine_starts_and_sets_conversation_id():
    agents = [make_mock_agent(f"agent_{i}", f"Response {i}") for i in range(6)]
    db = make_mock_db(conv_id=42)
    broadcast = AsyncMock()

    with patch("engine.ConversationEngine._run_one_agent", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = "Test response"
        engine = ConversationEngine(agents=agents, broadcast=broadcast, db=db, delay=0)
        conv_id = await engine.start(topic="Climate change", llm_provider="claude")
        assert conv_id == 42
        await asyncio.sleep(0.05)
        await engine.stop()

async def test_engine_pause_stops_agent_calls():
    agents = [make_mock_agent(f"agent_{i}", f"Resp {i}") for i in range(6)]
    db = make_mock_db()
    broadcast = AsyncMock()
    call_count = 0

    async def counting_run(agent, topic, history, moderator_input):
        nonlocal call_count
        call_count += 1
        return "response"

    with patch("engine.ConversationEngine._run_one_agent", side_effect=counting_run):
        engine = ConversationEngine(agents=agents, broadcast=broadcast, db=db, delay=0)
        await engine.start(topic="Test", llm_provider="claude")
        await asyncio.sleep(0.05)
        await engine.pause()
        count_at_pause = call_count
        await asyncio.sleep(0.1)
        assert call_count == count_at_pause  # no new calls after pause
        await engine.stop()

async def test_engine_inject_sets_moderator_input():
    agents = [make_mock_agent(f"agent_{i}", "resp") for i in range(6)]
    db = make_mock_db()
    broadcast = AsyncMock()

    with patch("engine.ConversationEngine._run_one_agent", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = "response"
        engine = ConversationEngine(agents=agents, broadcast=broadcast, db=db, delay=0)
        await engine.start(topic="Test", llm_provider="claude")
        await engine.inject("What about nuclear energy?")
        assert engine._moderator_input == "What about nuclear energy?"
        await engine.stop()

async def test_engine_formats_history():
    agents = [make_mock_agent(f"agent_{i}", "resp") for i in range(6)]
    db = make_mock_db()
    broadcast = AsyncMock()

    with patch("engine.ConversationEngine._run_one_agent", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = "response"
        engine = ConversationEngine(agents=agents, broadcast=broadcast, db=db, delay=0)
        engine._history = [
            {"agent_id": "prof_quark", "agent_name": "Prof. Isacco Quark", "text": "Hello"},
            {"agent_id": "bobby_ray", "agent_name": "Bobby Ray Buster", "text": "Fake news!"},
        ]
        formatted = engine._format_history()
        assert "[Prof. Isacco Quark]: Hello" in formatted
        assert "[Bobby Ray Buster]: Fake news!" in formatted
```

- [ ] **Step 6.2: Run tests — verify they fail**

```bash
pytest tests/test_engine.py -v
```

Expected: `ModuleNotFoundError: No module named 'engine'`

- [ ] **Step 6.3: Implement engine.py**

```python
# backend/engine.py
import asyncio
import random
from datetime import datetime
from typing import Callable, Any
from google.adk.agents import LlmAgent
from google.adk.runners import InMemoryRunner
from google.genai import types as genai_types
from agents.personas import AGENT_PERSONAS

HISTORY_LIMIT = 20  # keep last N messages in context

class ConversationEngine:
    def __init__(
        self,
        agents: list[LlmAgent],
        broadcast: Callable,
        db: Any,
        delay: int = 20,
    ):
        self._agents = agents
        self._broadcast = broadcast
        self._db = db
        self._delay = delay
        self._task: asyncio.Task | None = None
        self._running = asyncio.Event()
        self._stopped = False
        self._history: list[dict] = []
        self._topic: str = ""
        self._moderator_input: str = ""
        self._conversation_id: int | None = None

    async def start(self, topic: str, llm_provider: str) -> int:
        self._topic = topic
        self._history = []
        self._moderator_input = ""
        self._stopped = False
        self._running.set()
        self._conversation_id = await self._db.create_conversation(
            topic=topic, llm_provider=llm_provider
        )
        await self._broadcast({"type": "topic_set", "topic": topic, "conversation_id": self._conversation_id})
        await self._broadcast({"type": "status", "value": "running"})
        self._task = asyncio.create_task(self._loop())
        return self._conversation_id

    async def pause(self):
        self._running.clear()
        await self._broadcast({"type": "status", "value": "paused"})

    async def resume(self):
        self._running.set()
        await self._broadcast({"type": "status", "value": "running"})

    async def inject(self, moderator_text: str):
        self._moderator_input = moderator_text

    async def stop(self):
        self._stopped = True
        self._running.set()  # unblock if paused
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._conversation_id:
            await self._db.end_conversation(self._conversation_id)
        await self._broadcast({"type": "status", "value": "stopped"})

    def _format_history(self) -> str:
        if not self._history:
            return "(No messages yet — start the conversation!)"
        lines = []
        for msg in self._history[-HISTORY_LIMIT:]:
            lines.append(f"[{msg['agent_name']}]: {msg['text']}")
        return "\n".join(lines)

    async def _run_one_agent(
        self, agent: LlmAgent, topic: str, history: str, moderator_input: str
    ) -> str:
        """Run a single agent turn via ADK InMemoryRunner. Returns the response text."""
        runner = InMemoryRunner(agent=agent, app_name="the_saloon")
        session = await runner.session_service.create_session(
            app_name="the_saloon",
            user_id="engine",
            state={
                "topic": topic,
                "conversation_history": history,
                "moderator_input": moderator_input if moderator_input else "(none)",
            },
        )
        trigger = genai_types.Content(
            role="user",
            parts=[genai_types.Part(text="Continue the conversation in character.")],
        )
        response_text = ""
        async for event in runner.run_async(
            user_id="engine",
            session_id=session.id,
            new_message=trigger,
        ):
            if event.is_final_response() and event.content and event.content.parts:
                response_text = event.content.parts[0].text or ""
        return response_text.strip()

    async def _loop(self):
        while not self._stopped:
            await self._running.wait()
            if self._stopped:
                break

            shuffled = random.sample(self._agents, len(self._agents))
            moderator_input_this_cycle = self._moderator_input

            for i, agent in enumerate(shuffled):
                if self._stopped:
                    break
                await self._running.wait()

                # First agent in cycle consumes the moderator input
                current_moderator = moderator_input_this_cycle if i == 0 else ""
                if i == 0:
                    self._moderator_input = ""  # clear after first agent reads it

                await self._broadcast({"type": "agent_thinking", "agent": agent.name})

                try:
                    history = self._format_history()
                    text = await self._run_one_agent(
                        agent=agent,
                        topic=self._topic,
                        history=history,
                        moderator_input=current_moderator,
                    )
                except Exception as e:
                    text = f"[error: {str(e)}]"

                if not text:
                    continue

                persona = AGENT_PERSONAS.get(agent.name, {})
                agent_name = persona.get("name", agent.name)
                timestamp = datetime.utcnow().isoformat()

                self._history.append({
                    "agent_id": agent.name,
                    "agent_name": agent_name,
                    "text": text,
                    "timestamp": timestamp,
                })

                await self._broadcast({
                    "type": "message",
                    "agent": agent.name,
                    "agent_name": agent_name,
                    "text": text,
                    "timestamp": timestamp,
                })

                if self._conversation_id:
                    await self._db.save_message(
                        self._conversation_id, agent_id=agent.name, text=text
                    )

                await asyncio.sleep(self._delay)
```

- [ ] **Step 6.4: Run tests — verify they pass**

```bash
pytest tests/test_engine.py -v
```

Expected: `4 passed`

- [ ] **Step 6.5: Commit**

```bash
git add backend/engine.py backend/tests/test_engine.py
git commit -m "feat: conversation engine (ADK loop, pause/resume, inject)"
```

---

## Task 7: FastAPI App

**Files:**
- Create: `backend/main.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 7.1: Write failing tests**

```python
# backend/tests/test_api.py
import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

@pytest.fixture
def client():
    mock_db = AsyncMock()
    mock_db.init = AsyncMock()
    mock_db.list_conversations = AsyncMock(return_value=[])
    mock_db.get_conversation = AsyncMock(return_value=None)
    mock_db.get_messages = AsyncMock(return_value=[])
    mock_db.get_setting = AsyncMock(return_value=None)
    mock_db.set_setting = AsyncMock()

    mock_engine = AsyncMock()
    mock_engine.start = AsyncMock(return_value=1)
    mock_engine.pause = AsyncMock()
    mock_engine.resume = AsyncMock()
    mock_engine.inject = AsyncMock()
    mock_engine.stop = AsyncMock()

    with patch("main.Database", return_value=mock_db), \
         patch("main.build_agents", return_value=[]), \
         patch("main.ConversationEngine", return_value=mock_engine), \
         patch("main.make_search_tool", return_value=MagicMock()), \
         patch("main.Settings") as MockSettings:
        mock_settings = AsyncMock()
        mock_settings.get_model_string = AsyncMock(return_value="anthropic/claude-sonnet-4-6")
        mock_settings.get_delay = AsyncMock(return_value=20)
        mock_settings.get_search_provider = AsyncMock(return_value="tavily")
        mock_settings.get = AsyncMock(return_value="fake-key")
        MockSettings.return_value = mock_settings

        from main import app
        with TestClient(app) as c:
            yield c, mock_engine, mock_db

def test_health(client):
    c, _, _ = client
    resp = c.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

def test_start_conversation(client):
    c, mock_engine, _ = client
    resp = c.post("/api/conversations/start", json={"topic": "Climate change"})
    assert resp.status_code == 200
    assert resp.json()["conversation_id"] == 1

def test_pause_conversation(client):
    c, mock_engine, _ = client
    resp = c.post("/api/conversations/pause")
    assert resp.status_code == 200

def test_resume_conversation(client):
    c, mock_engine, _ = client
    resp = c.post("/api/conversations/resume")
    assert resp.status_code == 200

def test_inject_message(client):
    c, mock_engine, _ = client
    resp = c.post("/api/conversations/inject", json={"text": "What about nuclear?"})
    assert resp.status_code == 200

def test_list_conversations(client):
    c, _, mock_db = client
    mock_db.list_conversations.return_value = [
        {"id": 1, "topic": "Test", "llm_provider": "claude",
         "created_at": "2026-01-01", "ended_at": None, "title": "Test"}
    ]
    resp = c.get("/api/conversations")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

def test_get_settings(client):
    c, _, mock_db = client
    resp = c.get("/api/settings")
    assert resp.status_code == 200
    assert "llm_provider" in resp.json()

def test_put_settings(client):
    c, _, mock_db = client
    resp = c.put("/api/settings", json={"key": "delay", "value": "30"})
    assert resp.status_code == 200
```

- [ ] **Step 7.2: Run tests — verify they fail**

```bash
pytest tests/test_api.py -v
```

Expected: `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 7.3: Implement main.py**

```python
# backend/main.py
import json
import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database import Database
from config import Settings
from engine import ConversationEngine
from agents.factory import build_agents
from agents.search_tool import make_search_tool

# ── Globals ──────────────────────────────────────────────────────────────────
db: Database = None
settings: Settings = None
engine: ConversationEngine = None
ws_clients: list[WebSocket] = []

# ── Startup / Shutdown ────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, settings, engine
    db = Database()
    await db.init()
    settings = Settings(db=db)

    model_string = await settings.get_model_string()
    search_provider = await settings.get_search_provider()
    api_key = await settings.get("TAVILY_API_KEY") if search_provider == "tavily" else None
    search_tool = make_search_tool(provider=search_provider, api_key=api_key)
    agents = build_agents(model_string=model_string, search_tool=search_tool)
    delay = await settings.get_delay()

    engine = ConversationEngine(
        agents=agents,
        broadcast=broadcast,
        db=db,
        delay=delay,
    )
    yield
    if engine:
        await engine.stop()
    await db.close()

app = FastAPI(title="The Saloon", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── WebSocket ─────────────────────────────────────────────────────────────────
async def broadcast(event: dict):
    dead = []
    for ws in ws_clients:
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            dead.append(ws)
    for ws in dead:
        ws_clients.remove(ws)

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.append(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive; FE doesn't send via WS
    except WebSocketDisconnect:
        ws_clients.remove(ws)

# ── REST API ──────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok"}

class StartRequest(BaseModel):
    topic: str

@app.post("/api/conversations/start")
async def start_conversation(req: StartRequest):
    llm_provider = await settings.get("LLM_PROVIDER", default="claude")
    conv_id = await engine.start(topic=req.topic, llm_provider=llm_provider)
    return {"conversation_id": conv_id}

@app.post("/api/conversations/pause")
async def pause_conversation():
    await engine.pause()
    return {"status": "paused"}

@app.post("/api/conversations/resume")
async def resume_conversation():
    await engine.resume()
    return {"status": "running"}

class InjectRequest(BaseModel):
    text: str

@app.post("/api/conversations/inject")
async def inject_message(req: InjectRequest):
    await engine.inject(req.text)
    return {"status": "injected"}

@app.get("/api/conversations")
async def list_conversations():
    return await db.list_conversations()

@app.get("/api/conversations/{conv_id}")
async def get_conversation(conv_id: int):
    conv = await db.get_conversation(conv_id)
    if not conv:
        return JSONResponse(status_code=404, content={"error": "not found"})
    messages = await db.get_messages(conv_id)
    return {"conversation": conv, "messages": messages}

@app.get("/api/settings")
async def get_settings():
    keys = [
        "LLM_PROVIDER", "SEARCH_PROVIDER", "CONVERSATION_DELAY_SECONDS",
        "OLLAMA_BASE_URL", "OLLAMA_MODEL",
    ]
    result = {}
    for k in keys:
        result[k.lower()] = await settings.get(k, default="")
    return result

class SettingUpdate(BaseModel):
    key: str
    value: str

@app.put("/api/settings")
async def update_setting(req: SettingUpdate):
    await db.set_setting(req.key, req.value)
    return {"status": "updated"}
```

- [ ] **Step 7.4: Run tests — verify they pass**

```bash
pytest tests/test_api.py -v
```

Expected: `8 passed`

- [ ] **Step 7.5: Run all backend tests**

```bash
pytest -v
```

Expected: all tests pass (no failures)

- [ ] **Step 7.6: Smoke-test the server manually**

Copy `.env.example` to `.env` and fill in your `ANTHROPIC_API_KEY` and `TAVILY_API_KEY`. Then:

```bash
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000/api/health` in browser.
Expected: `{"status":"ok"}`

- [ ] **Step 7.7: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat: FastAPI app with WebSocket, REST API, lifespan startup"
```

---

## Task 8: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/types.ts`

- [ ] **Step 8.1: Initialize Vite + React + TypeScript project**

```bash
cd /path/to/the-saloon
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install zustand tailwindcss @tailwindcss/vite
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 8.2: Configure vite.config.ts**

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
```

- [ ] **Step 8.3: Create frontend/src/types.ts**

```typescript
// frontend/src/types.ts

export type AgentId =
  | 'prof_quark'
  | 'bobby_ray'
  | 'karl_rosso'
  | 'marco_buonsenso'
  | 'gigi_bellavita'
  | 'zoe_futura'

export interface AgentMeta {
  id: AgentId
  name: string
  color: string
  archetype: string
  description: string
}

export const AGENTS: AgentMeta[] = [
  { id: 'prof_quark',      name: 'Prof. Isacco Quark', color: '#88aaff', archetype: 'The Scientist',    description: 'Rational, evidence-based. Cites sources, corrects others gently with data.' },
  { id: 'bobby_ray',       name: 'Bobby Ray Buster',   color: '#ff6644', archetype: 'The Redneck',      description: 'Ultra-right American. Beer, BBQ, anti-establishment. 🍺' },
  { id: 'karl_rosso',      name: 'Comrade Karl Rosso', color: '#ff4444', archetype: 'The Communist',    description: 'Every topic leads back to capitalism as the root cause.' },
  { id: 'marco_buonsenso', name: 'Marco Buonsenso',    color: '#88cc88', archetype: 'The Center-Right', description: 'Moderate conservative. Seeks compromise, dislikes extremism.' },
  { id: 'gigi_bellavita',  name: 'Gigi Bellavita',     color: '#ffcc44', archetype: 'The Simple One',   description: 'Hedonistic and distracted. Only cares about food, friends, and fun.' },
  { id: 'zoe_futura',      name: 'Zoe Futura',         color: '#ff88cc', archetype: 'The Young Idealist','description': 'Angry, well-educated. Wants to change the world before it\'s too late.' },
]

export type EngineStatus = 'idle' | 'running' | 'paused' | 'stopped'

export interface ChatMessage {
  id: string            // uuid or timestamp-agent
  agentId: AgentId
  agentName: string
  text: string
  timestamp: string
}

export interface WsEvent {
  type: 'message' | 'agent_thinking' | 'status' | 'topic_set'
  agent?: AgentId
  agent_name?: string
  text?: string
  timestamp?: string
  value?: EngineStatus
  topic?: string
  conversation_id?: number
}

export interface Conversation {
  id: number
  title: string
  topic: string
  llm_provider: string
  created_at: string
  ended_at: string | null
}

export interface AppSettings {
  llm_provider: string
  search_provider: string
  conversation_delay_seconds: string
  ollama_base_url: string
  ollama_model: string
}
```

- [ ] **Step 8.4: Create frontend/src/main.tsx**

```tsx
// frontend/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8.5: Create frontend/src/App.tsx (skeleton)**

```tsx
// frontend/src/App.tsx
import { useState } from 'react'
import SaloonPage from './components/SaloonPage'
import SettingsPage from './components/SettingsPage'

export default function App() {
  const [page, setPage] = useState<'saloon' | 'settings'>('saloon')

  return (
    <div className="min-h-screen" style={{ background: '#0d0500', color: '#e8d8b0' }}>
      {page === 'saloon'
        ? <SaloonPage onOpenSettings={() => setPage('settings')} />
        : <SettingsPage onBack={() => setPage('saloon')} />
      }
    </div>
  )
}
```

- [ ] **Step 8.6: Verify frontend starts**

```bash
cd frontend
npm run dev
```

Expected: `Local: http://localhost:5173/` — page loads (blank or error is fine, scaffold only).

- [ ] **Step 8.7: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: frontend scaffold (Vite + React + TS + Tailwind + Zustand)"
```

---

## Task 9: Store, API Client & WebSocket Hook

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/store/saloonStore.ts`
- Create: `frontend/src/hooks/useWebSocket.ts`

- [ ] **Step 9.1: Create frontend/src/api/client.ts**

```typescript
// frontend/src/api/client.ts
import type { Conversation, AppSettings } from '../types'

const BASE = '/api'

export async function startConversation(topic: string): Promise<{ conversation_id: number }> {
  const res = await fetch(`${BASE}/conversations/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  })
  return res.json()
}

export async function pauseConversation(): Promise<void> {
  await fetch(`${BASE}/conversations/pause`, { method: 'POST' })
}

export async function resumeConversation(): Promise<void> {
  await fetch(`${BASE}/conversations/resume`, { method: 'POST' })
}

export async function injectMessage(text: string): Promise<void> {
  await fetch(`${BASE}/conversations/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${BASE}/conversations`)
  return res.json()
}

export async function getConversation(id: number): Promise<{ conversation: Conversation; messages: any[] }> {
  const res = await fetch(`${BASE}/conversations/${id}`)
  return res.json()
}

export async function getSettings(): Promise<AppSettings> {
  const res = await fetch(`${BASE}/settings`)
  return res.json()
}

export async function updateSetting(key: string, value: string): Promise<void> {
  await fetch(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
}
```

- [ ] **Step 9.2: Create frontend/src/store/saloonStore.ts**

```typescript
// frontend/src/store/saloonStore.ts
import { create } from 'zustand'
import type { ChatMessage, EngineStatus, AgentId } from '../types'

interface SaloonState {
  messages: ChatMessage[]
  status: EngineStatus
  thinkingAgent: AgentId | null
  topic: string
  conversationId: number | null
  addMessage: (msg: ChatMessage) => void
  setStatus: (s: EngineStatus) => void
  setThinkingAgent: (id: AgentId | null) => void
  setTopic: (topic: string, convId: number) => void
  clearMessages: () => void
}

export const useSaloonStore = create<SaloonState>((set) => ({
  messages: [],
  status: 'idle',
  thinkingAgent: null,
  topic: '',
  conversationId: null,

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages.slice(-99), msg],  // keep last 100
      thinkingAgent: null,
    })),

  setStatus: (status) => set({ status }),

  setThinkingAgent: (thinkingAgent) => set({ thinkingAgent }),

  setTopic: (topic, conversationId) =>
    set({ topic, conversationId, messages: [], status: 'running' }),

  clearMessages: () => set({ messages: [], topic: '', conversationId: null, status: 'idle' }),
}))
```

- [ ] **Step 9.3: Create frontend/src/hooks/useWebSocket.ts**

```typescript
// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef } from 'react'
import { useSaloonStore } from '../store/saloonStore'
import type { WsEvent } from '../types'

const WS_URL = `ws://${window.location.host}/ws`

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const { addMessage, setStatus, setThinkingAgent, setTopic } = useSaloonStore()

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const event: WsEvent = JSON.parse(e.data)
          if (event.type === 'message' && event.agent && event.text) {
            addMessage({
              id: `${event.timestamp}-${event.agent}`,
              agentId: event.agent,
              agentName: event.agent_name ?? event.agent,
              text: event.text,
              timestamp: event.timestamp ?? new Date().toISOString(),
            })
          } else if (event.type === 'agent_thinking' && event.agent) {
            setThinkingAgent(event.agent)
          } else if (event.type === 'status' && event.value) {
            setStatus(event.value)
          } else if (event.type === 'topic_set' && event.topic && event.conversation_id) {
            setTopic(event.topic, event.conversation_id)
          }
        } catch (_) { /* ignore malformed events */ }
      }

      ws.onclose = () => {
        setTimeout(connect, 3000)  // auto-reconnect after 3s
      }
    }

    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [])
}
```

- [ ] **Step 9.4: Commit**

```bash
git add frontend/src/api/ frontend/src/store/ frontend/src/hooks/
git commit -m "feat: API client, Zustand store, WebSocket hook"
```

---

## Task 10: Saloon Scene — Background & Characters

**Files:**
- Create: `frontend/src/components/Background.tsx`
- Create: `frontend/src/components/Character.tsx`
- Create: `frontend/src/components/SpeechBubble.tsx`
- Create: `frontend/src/components/SaloonScene.tsx`

- [ ] **Step 10.1: Create Background.tsx**

```tsx
// frontend/src/components/Background.tsx
export default function Background() {
  return (
    <svg
      viewBox="0 0 800 500"
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'pixelated' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Sky / back wall */}
      <rect width="800" height="500" fill="#1a0800" />

      {/* Back wall planks */}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x={0} y={i * 80} width="800" height="78" fill={i % 2 === 0 ? '#2d1500' : '#251000'} />
      ))}

      {/* Saloon sign */}
      <rect x="250" y="20" width="300" height="48" fill="#3d1e00" rx="2" />
      <rect x="254" y="24" width="292" height="40" fill="#2d1200" rx="1" />
      <text x="400" y="52" textAnchor="middle" fill="#f0c060"
        style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 'bold', letterSpacing: '4px' }}>
        ★ THE SALOON ★
      </text>

      {/* Lamps */}
      {[150, 400, 650].map(x => (
        <g key={x}>
          <rect x={x - 1} y={0} width={2} height={60} fill="#5d3000" />
          <polygon points={`${x},60 ${x-16},90 ${x+16},90`} fill="#f0c060" opacity="0.9" />
          <ellipse cx={x} cy={95} rx={20} ry={8} fill="#f0c060" opacity="0.25" />
        </g>
      ))}

      {/* Bar counter */}
      <rect x="0" y="340" width="800" height="20" fill="#5d3000" />
      <rect x="0" y="330" width="800" height="12" fill="#8d6000" />
      {/* Bar front planks */}
      {[0,4,8,12,16].map(i => (
        <rect key={i} x={0} y={360 + i * 14} width="800" height="12" fill={i % 2 === 0 ? '#3d1e00' : '#2d1500'} />
      ))}

      {/* Floor */}
      {Array.from({ length: 50 }, (_, i) => (
        <rect key={i} x={i * 16} y={430} width="14" height="70" fill={i % 2 === 0 ? '#3d2000' : '#2d1800'} />
      ))}

      {/* Beer mugs on bar */}
      {[120, 240, 560, 680].map(x => (
        <g key={x}>
          <rect x={x} y={310} width="16" height="20" fill="#88ccff" opacity="0.6" rx="1" />
          <rect x={x - 1} y={308} width="18" height="4" fill="#fff" opacity="0.4" />
        </g>
      ))}
    </svg>
  )
}
```

- [ ] **Step 10.2: Create SpeechBubble.tsx**

```tsx
// frontend/src/components/SpeechBubble.tsx
import { useEffect, useState } from 'react'

interface Props {
  text: string
  color: string
  onDismiss: () => void
}

export default function SpeechBubble({ text, color, onDismiss }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [visible, setVisible] = useState(true)

  // Typewriter effect
  useEffect(() => {
    setDisplayed('')
    setVisible(true)
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, 20)
    return () => clearInterval(interval)
  }, [text])

  // Auto-dismiss after 5 seconds from full text rendered
  useEffect(() => {
    const timeout = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)  // wait for fade-out
    }, 5000)
    return () => clearTimeout(timeout)
  }, [text, onDismiss])

  return (
    <div
      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
      }}
    >
      <div
        className="relative px-3 py-2 rounded text-xs max-w-[180px] text-center"
        style={{
          background: 'rgba(5, 2, 0, 0.92)',
          border: `2px solid ${color}`,
          color: '#e8d8b0',
          fontFamily: 'monospace',
          lineHeight: '1.4',
          boxShadow: `0 0 8px ${color}40`,
          wordBreak: 'break-word',
        }}
      >
        {displayed}
        {/* tail */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full"
          style={{
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `6px solid ${color}`,
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 10.3: Create Character.tsx**

```tsx
// frontend/src/components/Character.tsx
import { useState, useCallback } from 'react'
import type { AgentMeta, ChatMessage } from '../types'
import SpeechBubble from './SpeechBubble'

interface Props {
  agent: AgentMeta
  isTalking: boolean
  isThinking: boolean
  lastMessage: ChatMessage | null
}

// Simple pixel-art character as SVG (32×48 logical units)
function CharacterSprite({ color, isTalking, isThinking }: { color: string; isTalking: boolean; isThinking: boolean }) {
  const bodyColor = color
  const skinTone = '#f4c884'
  const bounce = isTalking ? 'animate-bounce' : ''

  return (
    <svg
      viewBox="0 0 32 48"
      width="48"
      height="72"
      style={{ imageRendering: 'pixelated' }}
      className={bounce}
    >
      {/* Head */}
      <rect x="10" y="0" width="12" height="12" fill={skinTone} />
      {/* Eyes */}
      <rect x="12" y="3" width="2" height="2" fill="#333" />
      <rect x="18" y="3" width="2" height="2" fill="#333" />
      {/* Mouth — open when talking */}
      {isTalking
        ? <rect x="13" y="8" width="6" height="2" fill="#333" />
        : <rect x="13" y="8" width="6" height="1" fill="#555" />
      }
      {/* Body */}
      <rect x="8" y="12" width="16" height="18" fill={bodyColor} />
      {/* Arms */}
      <rect x="2" y="13" width="6" height="12" fill={bodyColor} />
      <rect x="24" y="13" width="6" height="12" fill={bodyColor} />
      {/* Legs */}
      <rect x="9" y="30" width="5" height="14" fill="#333" />
      <rect x="18" y="30" width="5" height="14" fill="#333" />
      {/* Feet */}
      <rect x="7" y="42" width="8" height="4" fill="#222" />
      <rect x="17" y="42" width="8" height="4" fill="#222" />
      {/* Thinking dots */}
      {isThinking && (
        <>
          <circle cx="22" cy="2" r="1.5" fill="#f0c060" opacity="0.9" />
          <circle cx="26" cy="0" r="1" fill="#f0c060" opacity="0.7" />
          <circle cx="29" cy="-1" r="0.7" fill="#f0c060" opacity="0.5" />
        </>
      )}
    </svg>
  )
}

interface ProfileModalProps {
  agent: AgentMeta
  onClose: () => void
}

function ProfileModal({ agent, onClose }: ProfileModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="p-6 rounded max-w-sm w-full mx-4"
        style={{ background: '#1a0800', border: `2px solid ${agent.color}`, fontFamily: 'monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1" style={{ color: agent.color }}>{agent.name}</h2>
        <p className="text-xs mb-2" style={{ color: '#f0c060' }}>{agent.archetype}</p>
        <p className="text-sm" style={{ color: '#e8d8b0' }}>{agent.description}</p>
        <button
          className="mt-4 text-xs px-3 py-1 rounded"
          style={{ background: agent.color, color: '#000' }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default function Character({ agent, isTalking, isThinking, lastMessage }: Props) {
  const [showProfile, setShowProfile] = useState(false)
  const [bubble, setBubble] = useState<ChatMessage | null>(lastMessage)

  // Show new bubble when lastMessage changes
  useState(() => { setBubble(lastMessage) })

  const dismiss = useCallback(() => setBubble(null), [])

  // Sync bubble with lastMessage prop
  if (lastMessage && bubble?.id !== lastMessage.id) {
    setBubble(lastMessage)
  }

  return (
    <>
      <div
        className="relative flex flex-col items-center cursor-pointer select-none"
        onClick={() => setShowProfile(true)}
        title={`${agent.name} — click for profile`}
      >
        {bubble && (
          <SpeechBubble
            text={bubble.text}
            color={agent.color}
            onDismiss={dismiss}
          />
        )}
        <CharacterSprite
          color={agent.color}
          isTalking={isTalking}
          isThinking={isThinking}
        />
        <span
          className="text-xs mt-1 font-bold"
          style={{ color: agent.color, fontFamily: 'monospace', textShadow: '1px 1px 0 #000' }}
        >
          {agent.name.split(' ')[0]}
        </span>
      </div>
      {showProfile && <ProfileModal agent={agent} onClose={() => setShowProfile(false)} />}
    </>
  )
}
```

- [ ] **Step 10.4: Create SaloonScene.tsx**

```tsx
// frontend/src/components/SaloonScene.tsx
import { useMemo } from 'react'
import { useSaloonStore } from '../store/saloonStore'
import { AGENTS } from '../types'
import Background from './Background'
import Character from './Character'

// Horizontal positions for 6 characters along the bar (as % of scene width)
const CHAR_POSITIONS = [6, 18, 32, 50, 64, 78]

export default function SaloonScene() {
  const { messages, thinkingAgent } = useSaloonStore()

  const lastMessagePerAgent = useMemo(() => {
    const map = new Map<string, typeof messages[0]>()
    for (const msg of messages) {
      map.set(msg.agentId, msg)
    }
    return map
  }, [messages])

  return (
    <div className="relative w-full" style={{ aspectRatio: '16/10', maxHeight: '70vh' }}>
      <Background />

      {/* Characters positioned along the bar */}
      {AGENTS.map((agent, idx) => {
        const left = CHAR_POSITIONS[idx]
        const isTalking = messages[messages.length - 1]?.agentId === agent.id
        const isThinking = thinkingAgent === agent.id
        const lastMsg = lastMessagePerAgent.get(agent.id) ?? null

        return (
          <div
            key={agent.id}
            className="absolute"
            style={{
              left: `${left}%`,
              bottom: '28%',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}
          >
            <Character
              agent={agent}
              isTalking={isTalking}
              isThinking={isThinking}
              lastMessage={lastMsg}
            />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 10.5: Commit**

```bash
git add frontend/src/components/Background.tsx frontend/src/components/Character.tsx frontend/src/components/SpeechBubble.tsx frontend/src/components/SaloonScene.tsx
git commit -m "feat: pixel-art saloon scene, character sprites, speech bubbles"
```

---

## Task 11: Message Log & Moderator Input

**Files:**
- Create: `frontend/src/components/MessageLog.tsx`
- Create: `frontend/src/components/ModeratorInput.tsx`
- Create: `frontend/src/components/SaloonPage.tsx`

- [ ] **Step 11.1: Create MessageLog.tsx**

```tsx
// frontend/src/components/MessageLog.tsx
import { useSaloonStore } from '../store/saloonStore'
import { AGENTS } from '../types'

const agentColorMap = Object.fromEntries(AGENTS.map(a => [a.id, a.color]))

export default function MessageLog() {
  const { messages, topic, status } = useSaloonStore()
  const recent = messages.slice(-4)

  return (
    <div
      className="absolute bottom-0 left-0 right-0 px-4 py-3 z-20"
      style={{
        background: 'linear-gradient(0deg, rgba(5,2,0,0.95) 70%, transparent)',
        fontFamily: 'monospace',
        minHeight: '90px',
      }}
    >
      {/* Topic bar */}
      {topic && (
        <div className="text-xs mb-2" style={{ color: '#f0c060' }}>
          <span style={{ color: '#888' }}>Topic: </span>{topic}
          <span className="ml-3" style={{ color: status === 'running' ? '#88ff88' : '#ff8844' }}>
            ● {status}
          </span>
        </div>
      )}

      {/* Last 4 messages */}
      <div className="space-y-1">
        {recent.map((msg) => (
          <div key={msg.id} className="text-xs leading-snug">
            <span style={{ color: agentColorMap[msg.agentId] ?? '#f0c060', fontWeight: 'bold' }}>
              {msg.agentName}:
            </span>{' '}
            <span style={{ color: '#c8b898' }}>
              {msg.text.length > 120 ? msg.text.slice(0, 120) + '…' : msg.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 11.2: Create ModeratorInput.tsx**

```tsx
// frontend/src/components/ModeratorInput.tsx
import { useState, FormEvent } from 'react'
import { useSaloonStore } from '../store/saloonStore'
import * as api from '../api/client'

interface Props {
  onOpenSettings: () => void
}

export default function ModeratorInput({ onOpenSettings }: Props) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const { status, topic } = useSaloonStore()

  const isIdle = status === 'idle' || status === 'stopped'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim() || loading) return
    setLoading(true)
    try {
      if (isIdle) {
        await api.startConversation(value.trim())
      } else {
        await api.injectMessage(value.trim())
      }
      setValue('')
    } finally {
      setLoading(false)
    }
  }

  async function handlePauseResume() {
    if (status === 'running') await api.pauseConversation()
    else if (status === 'paused') await api.resumeConversation()
  }

  return (
    <div className="relative z-30 px-4 py-3" style={{ background: '#0d0500', borderTop: '2px solid #3d1e00' }}>
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isIdle ? 'Enter a topic to start the debate…' : 'Intervene as moderator…'}
          disabled={loading}
          className="flex-1 px-3 py-2 rounded text-sm outline-none"
          style={{
            background: '#1a0800',
            border: '2px solid #f0c060',
            color: '#e8d8b0',
            fontFamily: 'monospace',
          }}
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="px-4 py-2 rounded text-sm font-bold"
          style={{
            background: value.trim() ? '#f0c060' : '#5d4020',
            color: '#000',
            fontFamily: 'monospace',
            cursor: value.trim() ? 'pointer' : 'default',
          }}
        >
          {isIdle ? 'START' : 'INJECT'}
        </button>

        {/* Pause/Resume */}
        {(status === 'running' || status === 'paused') && (
          <button
            type="button"
            onClick={handlePauseResume}
            className="px-3 py-2 rounded text-sm"
            style={{
              background: status === 'running' ? '#442200' : '#224400',
              border: '1px solid #f0c060',
              color: '#f0c060',
              fontFamily: 'monospace',
            }}
          >
            {status === 'running' ? '⏸' : '▶'}
          </button>
        )}

        {/* Settings icon */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="px-3 py-2 rounded text-sm"
          style={{ background: '#1a0800', border: '1px solid #3d1e00', color: '#888' }}
          title="Settings"
        >
          ⚙️
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 11.3: Create SaloonPage.tsx**

```tsx
// frontend/src/components/SaloonPage.tsx
import { useWebSocket } from '../hooks/useWebSocket'
import SaloonScene from './SaloonScene'
import MessageLog from './MessageLog'
import ModeratorInput from './ModeratorInput'

interface Props {
  onOpenSettings: () => void
}

export default function SaloonPage({ onOpenSettings }: Props) {
  useWebSocket()

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0d0500' }}>
      {/* Scene takes all available vertical space */}
      <div className="flex-1 relative overflow-hidden">
        <SaloonScene />
        <MessageLog />
      </div>

      {/* Input bar at bottom */}
      <ModeratorInput onOpenSettings={onOpenSettings} />
    </div>
  )
}
```

- [ ] **Step 11.4: Verify main page renders**

Make sure backend is running (`uvicorn main:app --reload --port 8000`) and then:

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Expected: dark saloon background, 6 characters at the bar, input field at the bottom.

- [ ] **Step 11.5: Commit**

```bash
git add frontend/src/components/MessageLog.tsx frontend/src/components/ModeratorInput.tsx frontend/src/components/SaloonPage.tsx
git commit -m "feat: message log, moderator input, saloon page assembly"
```

---

## Task 12: Settings Page

**Files:**
- Create: `frontend/src/components/SettingsPage.tsx`

- [ ] **Step 12.1: Create SettingsPage.tsx**

```tsx
// frontend/src/components/SettingsPage.tsx
import { useEffect, useState } from 'react'
import type { AppSettings, Conversation } from '../types'
import * as api from '../api/client'
import { AGENTS } from '../types'

const agentColorMap = Object.fromEntries(AGENTS.map(a => [a.id, a.color]))
const agentNameMap = Object.fromEntries(AGENTS.map(a => [a.id, a.name]))

interface Props { onBack: () => void }

// ── Sub-components ────────────────────────────────────────────────────────────

function ConversationDetail({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    api.getConversation(conv.id).then((r) => setMessages(r.messages))
  }, [conv.id])

  return (
    <div>
      <button onClick={onBack} className="text-xs mb-4" style={{ color: '#f0c060' }}>← Back to history</button>
      <h3 className="font-bold mb-1" style={{ color: '#f0c060' }}>{conv.title}</h3>
      <p className="text-xs mb-4" style={{ color: '#888' }}>
        {new Date(conv.created_at).toLocaleString()} · {conv.llm_provider}
      </p>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {messages.map((m) => (
          <div key={m.id} className="text-xs">
            <span style={{ color: agentColorMap[m.agent_id] ?? '#f0c060', fontWeight: 'bold' }}>
              {agentNameMap[m.agent_id] ?? m.agent_id}:
            </span>{' '}
            <span style={{ color: '#c8b898' }}>{m.text}</span>
          </div>
        ))}
        {messages.length === 0 && <p style={{ color: '#666' }}>No messages.</p>}
      </div>
    </div>
  )
}

function HistorySection() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)

  useEffect(() => { api.listConversations().then(setConversations) }, [])

  if (selected) return <ConversationDetail conv={selected} onBack={() => setSelected(null)} />

  return (
    <div>
      <h3 className="font-bold mb-3" style={{ color: '#f0c060' }}>Conversation History</h3>
      {conversations.length === 0 && <p className="text-xs" style={{ color: '#666' }}>No conversations yet.</p>}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="w-full text-left px-3 py-2 rounded text-xs"
            style={{ background: '#1a0800', border: '1px solid #3d1e00' }}
          >
            <div style={{ color: '#e8d8b0', fontWeight: 'bold' }}>{c.title}</div>
            <div style={{ color: '#888' }}>{new Date(c.created_at).toLocaleDateString()} · {c.llm_provider}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main Settings Page ────────────────────────────────────────────────────────

export default function SettingsPage({ onBack }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'config' | 'history'>('config')

  useEffect(() => { api.getSettings().then(setSettings) }, [])

  async function save(key: string, value: string) {
    await api.updateSetting(key, value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle = {
    background: '#1a0800',
    border: '1px solid #5d3000',
    color: '#e8d8b0',
    fontFamily: 'monospace',
    padding: '6px 10px',
    borderRadius: '4px',
    width: '100%',
    fontSize: '13px',
  } as const

  const labelStyle = { color: '#888', fontSize: '11px', marginBottom: '4px', display: 'block' } as const

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} style={{ color: '#f0c060', fontSize: '13px' }}>← Back to Saloon</button>
        <h1 className="text-lg font-bold" style={{ color: '#f0c060' }}>⚙️ Settings</h1>
        {saved && <span style={{ color: '#88cc88', fontSize: '12px' }}>✓ Saved</span>}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['config', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1 rounded text-sm capitalize"
            style={{
              background: tab === t ? '#f0c060' : '#1a0800',
              color: tab === t ? '#000' : '#888',
              border: '1px solid #3d1e00',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'history' && <HistorySection />}

      {tab === 'config' && settings && (
        <div className="space-y-6">
          {/* LLM Provider */}
          <section>
            <h3 className="font-bold mb-3" style={{ color: '#f0c060' }}>LLM Provider</h3>
            <div className="space-y-3">
              <div>
                <label style={labelStyle}>Provider (claude | gemini | ollama)</label>
                <select
                  value={settings.llm_provider}
                  onChange={(e) => { setSettings({ ...settings, llm_provider: e.target.value }); save('LLM_PROVIDER', e.target.value) }}
                  style={inputStyle}
                >
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="gemini">Gemini (Google)</option>
                  <option value="ollama">Ollama (local)</option>
                </select>
              </div>
              {settings.llm_provider === 'ollama' && (
                <>
                  <div>
                    <label style={labelStyle}>Ollama base URL</label>
                    <input
                      style={inputStyle}
                      value={settings.ollama_base_url}
                      onChange={(e) => setSettings({ ...settings, ollama_base_url: e.target.value })}
                      onBlur={(e) => save('OLLAMA_BASE_URL', e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Ollama model</label>
                    <input
                      style={inputStyle}
                      value={settings.ollama_model}
                      onChange={(e) => setSettings({ ...settings, ollama_model: e.target.value })}
                      onBlur={(e) => save('OLLAMA_MODEL', e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Search Provider */}
          <section>
            <h3 className="font-bold mb-3" style={{ color: '#f0c060' }}>Search Provider</h3>
            <div>
              <label style={labelStyle}>Provider (tavily | duckduckgo)</label>
              <select
                value={settings.search_provider}
                onChange={(e) => { setSettings({ ...settings, search_provider: e.target.value }); save('SEARCH_PROVIDER', e.target.value) }}
                style={inputStyle}
              >
                <option value="tavily">Tavily (recommended)</option>
                <option value="duckduckgo">DuckDuckGo (no API key)</option>
              </select>
            </div>
          </section>

          {/* Conversation Speed */}
          <section>
            <h3 className="font-bold mb-3" style={{ color: '#f0c060' }}>Conversation Speed</h3>
            <div>
              <label style={labelStyle}>
                Delay between agents: {settings.conversation_delay_seconds}s
              </label>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={parseInt(settings.conversation_delay_seconds) || 20}
                onChange={(e) => setSettings({ ...settings, conversation_delay_seconds: e.target.value })}
                onMouseUp={(e) => save('CONVERSATION_DELAY_SECONDS', (e.target as HTMLInputElement).value)}
                style={{ width: '100%', accentColor: '#f0c060' }}
              />
              <div className="flex justify-between text-xs mt-1" style={{ color: '#666' }}>
                <span>5s (fast)</span><span>60s (slow)</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 12.2: Verify settings page renders**

Open `http://localhost:5173`, click ⚙️. Expected: Settings page with config and history tabs.

- [ ] **Step 12.3: Commit**

```bash
git add frontend/src/components/SettingsPage.tsx
git commit -m "feat: settings page (LLM, search, speed, conversation history)"
```

---

## Task 13: End-to-End Smoke Test & Fixes

At this point the full stack is wired together. Test the complete flow.

- [ ] **Step 13.1: Start the backend**

```bash
cd backend
source .venv/bin/activate
cp ../.env.example ../.env
# Edit .env: fill ANTHROPIC_API_KEY and TAVILY_API_KEY
uvicorn main:app --reload --port 8000
```

Expected: `Uvicorn running on http://127.0.0.1:8000`

- [ ] **Step 13.2: Start the frontend**

In a second terminal:

```bash
cd frontend
npm run dev
```

Expected: `Local: http://localhost:5173`

- [ ] **Step 13.3: Test the full debate flow**

1. Open `http://localhost:5173`
2. Type "Cambiamento climatico" in the input and press START
3. Verify: `topic_set` event fires, status shows "running"
4. Wait ~20 seconds — first agent should speak, speech bubble appears
5. Verify: character animates (bounce), bubble shows typewriter text
6. Inject "E il nucleare?" — verify next agent acknowledges it
7. Press ⏸ — verify agents stop talking
8. Press ▶ — verify debate resumes
9. Open ⚙️ → History tab — verify conversation is saved
10. Click the conversation → verify messages are listed

- [ ] **Step 13.4: Run all backend tests**

```bash
cd backend
pytest -v
```

Expected: all tests pass

- [ ] **Step 13.5: Commit**

```bash
git add -A
git commit -m "feat: complete The Saloon MVP — full debate loop, pixel-art UI, settings, history"
```

---

## Task 14: README

**Files:**
- Create: `README.md`

- [ ] **Step 14.1: Create README.md**

```markdown
# 🤠 The Saloon

A local web app where 6 AI agents with distinct personalities debate endlessly in a pixel-art western saloon. You are the moderator.

## Characters

| Name | Archetype | Color |
|------|-----------|-------|
| Prof. Isacco Quark | The Scientist | 🔵 |
| Bobby Ray Buster | The Redneck | 🟠 |
| Comrade Karl Rosso | The Communist | 🔴 |
| Marco Buonsenso | The Center-Right | 🟢 |
| Gigi Bellavita | The Simple One | 🟡 |
| Zoe Futura | The Young Idealist | 🩷 |

## Requirements

- Python 3.11+
- Node.js 18+
- An LLM API key (Claude, Gemini, or local Ollama)
- A search API key (Tavily recommended, or use DuckDuckGo for free)

## Quick Start

### 1. Clone and configure

```bash
git clone <repo>
cd the-saloon
cp .env.example .env
# Edit .env with your API keys
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — type a topic and press START.

---

## LLM Configuration

Edit `.env` to choose your provider:

### Claude (recommended)

```env
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```

Get an API key at https://console.anthropic.com

### Gemini

```env
LLM_PROVIDER=gemini
GOOGLE_API_KEY=AIza...
```

Get an API key at https://aistudio.google.com

> **Note:** With Gemini you can also use ADK's native `google_search` grounding tool (zero extra API key). To enable it, swap `search_tool` in `backend/agents/factory.py` with ADK's built-in `google_search` when `LLM_PROVIDER=gemini`.

### Ollama (local, no API key)

First install Ollama from https://ollama.ai and pull a model:

```bash
ollama pull llama3.2   # or mistral, qwen2.5, etc.
```

Then configure:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

> **Note:** Local models are significantly slower and may produce less coherent debate. Models with 7B+ parameters work best.

---

## Search Configuration

### Tavily (recommended)

```env
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=tvly-...
```

Get a free API key (1000 searches/month) at https://tavily.com

### DuckDuckGo (no API key)

```env
SEARCH_PROVIDER=duckduckgo
```

No API key required. Slightly less precise for scientific content.

---

## Runtime Settings

All settings can be changed at runtime via the ⚙️ Settings page — no restart needed. Changes are persisted in the local SQLite database and override `.env` values.

- **LLM Provider**: switch between Claude, Gemini, Ollama
- **Search Provider**: switch between Tavily and DuckDuckGo
- **Conversation Speed**: 5–60 second delay between agent turns

---

## Data

All data is stored locally in `backend/the_saloon.db` (SQLite). No data ever leaves your machine. Past conversations are accessible from the Settings → History tab.

---

## Language

The agents follow the moderator's language automatically. Write the topic in Italian → they debate in Italian. Write in English → English debate. No configuration needed.
```

- [ ] **Step 14.2: Commit**

```bash
git add README.md
git commit -m "docs: README with setup instructions for Claude, Gemini, Ollama"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|-----------------|-----------------|
| 6 agents with distinct personalities | Task 5 (personas.py) |
| ADK framework | Tasks 5, 6 (LlmAgent via LiteLlm) |
| Pixel-art western saloon FE | Tasks 10, 11 |
| Full-screen scene with speech bubbles | Tasks 10 (SaloonScene, SpeechBubble) |
| Continuous autonomous debate | Task 6 (ConversationEngine loop) |
| Random agent order | Task 6 (random.sample) |
| Moderator input/inject | Tasks 7 (API), 11 (ModeratorInput) |
| Language follows moderator | Task 5 (persona instructions) |
| WebSocket real-time updates | Tasks 7 (backend), 9 (useWebSocket) |
| React + FastAPI stack | Tasks 7, 8 |
| SQLite local DB | Task 2 |
| LiteLLM bridge (Claude/Gemini/Ollama) | Tasks 3, 5, 6 |
| Tavily + DuckDuckGo search | Task 4 |
| Configurable delay | Tasks 3, 7, 12 |
| Settings page (LLM, search, speed) | Task 12 |
| Conversation history (list + detail) | Task 12 (HistorySection) |
| Agent profile cards (click for bio) | Task 10 (Character.tsx ProfileModal) |
| README with LLM/search setup | Task 14 |
| Civil discussion rules | Task 5 (CIVILITY RULE in personas) |

All requirements covered. No gaps found.
```

- [ ] **Step 14.3: Final git log**

```bash
git log --oneline
```

Expected: ~14 commits from scaffold to README.
