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
