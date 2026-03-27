import pytest
import os
from unittest.mock import AsyncMock, patch
from config import Settings

async def test_get_llm_provider_from_env():
    mock_db = AsyncMock()
    mock_db.get_setting = AsyncMock(return_value=None)
    with patch.dict(os.environ, {"LLM_PROVIDER": "gemini"}):
        s = Settings(db=mock_db)
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
