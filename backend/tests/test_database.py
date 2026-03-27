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
