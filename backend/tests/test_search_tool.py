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

def test_search_handles_exception():
    with patch("agents.search_tool.DDGS") as MockDDGS:
        MockDDGS.return_value.__enter__.side_effect = Exception("connection timeout")
        tool = make_search_tool(provider="duckduckgo", api_key=None)
        result = tool("any query")
        assert isinstance(result, str)
        assert "Search error" in result
