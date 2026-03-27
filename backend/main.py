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

# ── WebSocket broadcast (defined before lifespan so engine can use it) ────────
async def broadcast(event: dict):
    dead = []
    for ws in ws_clients:
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            dead.append(ws)
    for ws in dead:
        ws_clients.remove(ws)

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
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.append(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive; FE doesn't send via WS
    except WebSocketDisconnect:
        if ws in ws_clients:
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
