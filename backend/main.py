# backend/main.py
import json
import asyncio
import os
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
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
sse_queues: list[asyncio.Queue] = []

# ── SSE broadcast (defined before lifespan so engine can use it) ──────────────
async def broadcast(event: dict):
    data = json.dumps(event)
    dead = []
    for q in sse_queues:
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        sse_queues.remove(q)

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
    ollama_base_url = await settings.get("OLLAMA_BASE_URL", default="http://localhost:11434")
    agents = build_agents(model_string=model_string, search_tool=search_tool, ollama_base_url=ollama_base_url)
    delay = await settings.get_delay()
    ollama_config = {"model": model_string, "api_base": ollama_base_url} if model_string.startswith("ollama/") else None

    engine = ConversationEngine(
        agents=agents,
        broadcast=broadcast,
        db=db,
        delay=delay,
        ollama_config=ollama_config,
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

# ── SSE ───────────────────────────────────────────────────────────────────────
@app.get("/events")
async def sse_endpoint(request: Request):
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    sse_queues.append(queue)

    async def event_stream():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"  # SSE comment, keeps connection alive
        finally:
            if queue in sse_queues:
                sse_queues.remove(queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# ── REST API ──────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok"}

class StartRequest(BaseModel):
    topic: str

@app.post("/api/conversations/start")
async def start_conversation(req: StartRequest):
    llm_provider = await settings.get("LLM_PROVIDER", default="claude")
    # Rebuild agents from current settings so provider changes don't need a restart
    model_string = await settings.get_model_string()
    search_provider = await settings.get_search_provider()
    api_key = await settings.get("TAVILY_API_KEY") if search_provider == "tavily" else None
    search_tool = make_search_tool(provider=search_provider, api_key=api_key)
    ollama_base_url = await settings.get("OLLAMA_BASE_URL", default="http://localhost:11434")
    ollama_config = {"model": model_string, "api_base": ollama_base_url} if model_string.startswith("ollama/") else None
    engine.update_agents(
        build_agents(model_string=model_string, search_tool=search_tool, ollama_base_url=ollama_base_url),
        ollama_config=ollama_config,
    )
    conv_id = await engine.start(topic=req.topic, llm_provider=llm_provider)
    return {"conversation_id": conv_id}

@app.post("/api/conversations/stop")
async def stop_conversation():
    await engine.stop()
    return {"status": "stopped"}

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

@app.delete("/api/conversations/{conv_id}")
async def delete_conversation(conv_id: int):
    conv = await db.get_conversation(conv_id)
    if not conv:
        return JSONResponse(status_code=404, content={"error": "not found"})
    await db.delete_conversation(conv_id)
    return {"status": "deleted"}

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
    # Validate key format: alphanumeric with underscores, must start with letter
    if not re.match(r'^[A-Za-z][A-Za-z0-9_]*$', req.key):
        return JSONResponse(status_code=400, content={"error": f"Invalid setting key: {req.key}"})
    await db.set_setting(req.key, req.value)
    return {"status": "updated"}
