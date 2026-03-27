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
