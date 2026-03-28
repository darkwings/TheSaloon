# The Saloon — Backend Architecture

## Bird's-eye view

```
Client (React)
    │  REST (commands)
    │  WebSocket (events, server→client only)
    ▼
FastAPI (main.py)
    │
    ├── ConversationEngine  ← asyncio loop, the beating heart
    │       ├── _run_one_agent_adk      (Claude / Gemini via Google ADK)
    │       └── _run_one_agent_direct   (Ollama via raw LiteLLM)
    │
    ├── Database            ← aiosqlite, single connection
    └── Settings            ← DB overrides .env chain
```

---

## Startup: the `lifespan` context manager

`main.py` uses FastAPI's `lifespan` pattern (the modern replacement for `@app.on_event`). Everything that needs to exist for the lifetime of the server is initialized here and torn down on shutdown:

```python
@asynccontextmanager
async def lifespan(app):
    db = Database(); await db.init()
    settings = Settings(db=db)
    agents = build_agents(...)
    engine = ConversationEngine(agents, broadcast, db, delay, ollama_config)
    yield                          # ← server runs here
    await engine.stop()
    await db.close()
```

Three globals exist (`db`, `settings`, `engine`) because FastAPI route handlers need them. They're module-level singletons — no dependency injection framework, no unnecessary complexity for a local app.

The agents are also rebuilt at every `POST /api/conversations/start` call (not just at startup). This means you can change the LLM provider in Settings and the next conversation will use it without restarting the server.

---

## ConversationEngine: the asyncio loop

`engine.py` is the most important file. It runs an infinite `asyncio.Task` that drives the debate.

### Pause / resume: `asyncio.Event`

```python
self._running = asyncio.Event()

async def pause(self):  self._running.clear()
async def resume(self): self._running.set()
```

Inside the loop, every iteration starts with `await self._running.wait()`. When `clear()` is called, this `await` blocks indefinitely. When `set()` is called, it unblocks. No polling, no sleep loops — this is the correct asyncio primitive for this pattern.

### Stop: task cancellation

```python
async def stop(self):
    self._stopped = True
    self._running.set()   # unblock if paused, so the task can exit
    self._task.cancel()
    await self._task      # wait for CancelledError to propagate
    await self._db.end_conversation(self._conversation_id)
```

`cancel()` injects a `CancelledError` at the next `await` point in the task. The `try/except CancelledError: pass` swallows it cleanly.

### One cycle

Each cycle of the loop:

1. Waits for `_running` (blocks if paused)
2. **Shuffles** the 6 agents — order is random every round
3. Captures and clears `_moderator_input` **synchronously** (before any `await`) — critical to avoid race conditions where two rapid injections could overwrite each other
4. Runs each agent sequentially, with a `delay` seconds sleep between messages

The moderator input is given only to the **first** agent of the cycle. The reasoning: if you inject "what about climate?" mid-debate, the first agent who speaks sees it and reacts. Subsequent agents in the same cycle see the reply in the history — they react to the reaction, which is more natural.

### History window

```python
HISTORY_LIMIT = 20  # last N messages passed to each agent
```

The full history is stored in `self._history` (a list of dicts). Each agent call receives a plain-text formatted version of the last 20 messages. There is no ADK session history — it's reset every turn (see next section).

---

## Two execution paths: ADK vs direct LiteLLM

This is the most architecturally interesting decision.

### ADK path (Claude, Gemini)

```python
runner = InMemoryRunner(agent=agent, app_name="the_saloon")
session = await runner.session_service.create_session(
    state={"topic": ..., "conversation_history": ..., "moderator_input": ...}
)
async for event in runner.run_async(...):
    if event.is_final_response():
        return event.content.parts[0].text
```

Google ADK's `LlmAgent` + `InMemoryRunner` handles the full agentic loop: it injects the system prompt, manages tool calls (web search), handles multi-step reasoning (the model calls `web_search`, gets results, generates a final reply). The session state dict is how we pass dynamic values (topic, history, moderator input) into the system prompt — ADK substitutes `{{topic}}` etc. with values from state.

A **fresh** `InMemoryRunner` is created per agent call. We deliberately don't accumulate ADK session history across turns. Why? ADK's session history would duplicate what we're already managing: our formatted `conversation_history` string contains everything the agent needs. Using ADK history too would double the context and cause context-length problems over long debates.

### Direct LiteLLM path (Ollama)

```python
import litellm
system_prompt = persona["instruction"]
    .replace("{topic}", topic)           # note: single-brace, not double
    .replace("{conversation_history}", history)
    .replace("{moderator_input}", ...)
response = await litellm.acompletion(
    model="ollama/llama3.2",
    api_base="http://localhost:11434",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": "Continue the conversation in character."},
    ],
)
```

Ollama needs this path for two reasons:

1. **Tool hallucination**: LLaMA-family models (and most local models) don't reliably follow ADK's function-calling schema. In testing, they invented tool names like `react_to_new_report` that don't exist in the schema, causing ADK to error or loop. Solution: disable tools for Ollama entirely (`tools=[]` in factory.py), and bypass ADK's runner overhead with a direct completion call.

2. **ADK overhead**: Even with tools disabled, ADK's `InMemoryRunner` adds a layer of abstractions (session service, event stream, multi-step loop) that confuses local models into producing partial or malformed responses. A direct `messages=[system, user]` call is far more reliable.

Note the subtle template difference: `personas.py` uses `{{topic}}` (double-brace, ADK substitution format) but the direct path uses `.replace("{topic}", ...)` with single braces. The ADK path doesn't call `.replace()` — ADK handles substitution itself from session state.

---

## Settings: DB → .env → default chain

```python
async def get(self, key: str, default=None):
    db_value = await self._db.get_setting(key)  # SQLite lookup
    if db_value is not None:
        return db_value
    return os.getenv(key, default)              # .env fallback
```

Settings changed via the UI are written to SQLite. They take precedence over the `.env` file. The `.env` is the install-time configuration; SQLite is the runtime configuration. This chain means:

- You can set `ANTHROPIC_API_KEY` in `.env` and never touch it again
- You can override `LLM_PROVIDER` or `CONVERSATION_DELAY_SECONDS` at runtime from the UI without editing files

Key validation on `PUT /api/settings` uses `^[A-Za-z][A-Za-z0-9_]*$` to prevent injection of arbitrary SQLite keys.

---

## SQLite schema

Three tables:

```sql
conversations (id, title, topic, llm_provider, created_at, ended_at)
messages      (id, conversation_id, agent_id, text, timestamp)
settings      (key, value)   -- PRIMARY KEY on key
```

`aiosqlite` wraps SQLite with `async/await`. A single connection is opened at startup and shared across all requests — SQLite handles this fine for a single-process local app. `row_factory = aiosqlite.Row` makes rows behave like dicts.

The `settings` table uses `INSERT ... ON CONFLICT(key) DO UPDATE SET value = excluded.value` (upsert) — cleaner than separate insert/update logic.

---

## SSE: server → client event stream

The frontend never sends commands over the event channel — it uses REST for that. The `/events` endpoint is a pure server-push stream implemented with SSE (`text/event-stream`), which is the correct tool for strictly unidirectional communication over HTTP.

Each connected client gets its own `asyncio.Queue`. `broadcast()` puts the serialized event into every queue:

```python
sse_queues: list[asyncio.Queue] = []

async def broadcast(event: dict):
    data = json.dumps(event)
    for q in sse_queues:
        try: q.put_nowait(data)
        except asyncio.QueueFull: ...  # remove dead client
```

The SSE handler reads from the queue with a 15-second timeout. On timeout it sends an SSE comment (`: keepalive`) to prevent proxies and browsers from closing the connection:

```python
@app.get("/events")
async def sse_endpoint(request: Request):
    queue = asyncio.Queue(maxsize=100)
    sse_queues.append(queue)

    async def event_stream():
        try:
            while True:
                if await request.is_disconnected(): break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            sse_queues.remove(queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
```

`X-Accel-Buffering: no` disables Nginx response buffering (relevant when running behind a reverse proxy).

On the frontend, `useEventSource` uses the browser's native `EventSource` API. On error it closes the connection and schedules a manual reconnect after 3 seconds:

```typescript
const es = new EventSource(`http://${window.location.hostname}:8000/events`)
es.onmessage = (e) => { /* same dispatch logic as before */ }
es.onerror = () => { es.close(); setTimeout(connect, 3000) }
```

Four event types flow over this channel:

| Type | Payload | Purpose |
|------|---------|---------|
| `message` | agent, agent_name, text, timestamp | New agent message |
| `agent_thinking` | agent (or null) | Show/clear thinking indicator |
| `status` | running / paused / stopped | Sync UI state |
| `topic_set` | topic, conversation_id | Conversation started |

`agent_thinking` with `agent: null` signals the engine skipped a turn (`[SKIP]` response or error) — the frontend clears the thinking spinner.

**Why SSE over WebSocket:** the communication is strictly unidirectional (server → client). WebSocket is designed for bidirectional streams; using it here required a dummy `receive_text()` loop just to keep the connection alive. SSE is the correct HTTP primitive for this pattern — simpler server code, no protocol upgrade, works transparently through proxies, and the browser handles reconnection natively.

---

## The [SKIP] mechanic

Each agent's system prompt contains:

> If the last few messages don't involve your interests at all, or if someone just made your exact point already, reply with exactly: `[SKIP]`

After getting a response, the engine checks:

```python
if not text or "[skip]" in text.lower():
    await self._broadcast({"type": "agent_thinking", "agent": None})
    continue
```

Full-text `in` check (not a prefix/length limit) because some models prepend words before `[SKIP]`. The agent is silently skipped — no message is stored, no UI entry appears. This makes the debate feel more natural: agents don't speak just to fill the round, they speak when they have something to say.

---

## Agent factory

```python
def build_agents(model_string, search_tool, ollama_base_url=None) -> list[LlmAgent]:
    litellm_kwargs = {"model": model_string}
    if is_ollama and ollama_base_url:
        litellm_kwargs["api_base"] = ollama_base_url
    tools = [] if is_ollama else [search_tool]

    for agent_id, persona in AGENT_PERSONAS.items():
        LlmAgent(name=agent_id, model=LiteLlm(**litellm_kwargs),
                 instruction=persona["instruction"], tools=tools)
```

ADK's native model interface (`google_search` grounding) only works with Gemini. Using `LiteLlm` as the model backend lets all three providers (Claude, Gemini, Ollama) work through the same `LlmAgent` interface with a custom search tool (Tavily or DuckDuckGo).

The search tool is a plain Python function `web_search(query: str) -> str`. ADK introspects its signature and docstring to build the tool schema for the LLM. No decorators or special registration needed.

---

## Design decisions summary

| Decision | Why |
|----------|-----|
| Fresh `InMemoryRunner` per turn | Avoids ADK context accumulation; history is already managed as a formatted string |
| Direct `litellm.acompletion` for Ollama | Local models hallucinate ADK tool schemas; plain system+user messages are more reliable |
| Moderator input cleared before `await` | Prevents race condition between `inject()` and the loop consuming the value |
| Agents rebuilt on every `/start` | Settings changes take effect immediately without restarting the server |
| DB overrides `.env` for settings | `.env` = install config; SQLite = runtime config. Clear separation. |
| SSE instead of WebSocket | Communication is strictly server→client; SSE is the correct HTTP primitive — no upgrade handshake, works through proxies, browser reconnects natively |
| `asyncio.Event` for pause | Zero-CPU blocking; no polling or sleep loops |
