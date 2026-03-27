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
