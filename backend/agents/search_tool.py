from typing import Callable
from duckduckgo_search import DDGS
from tavily import TavilyClient


def make_search_tool(provider: str, api_key: str | None) -> Callable[[str], str]:
    """Build a web_search tool bound to the given provider."""

    if provider == "tavily":
        client = TavilyClient(api_key=api_key or "")

        def web_search(query: str) -> str:
            """Search the web and return a summary of top results."""
            try:
                response = client.search(query, max_results=5)
                results = response.get("results", [])
                if not results:
                    return "No results found."
                parts = []
                for r in results:
                    parts.append(f"**{r.get('title', 'No title')}**\n{r.get('content', '')}\nSource: {r.get('url', '')}")
                return "\n\n".join(parts)
            except Exception as e:
                return f"Search error: {e}"

    else:  # duckduckgo
        def web_search(query: str) -> str:
            """Search the web and return a summary of top results."""
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(query, max_results=5))
                if not results:
                    return "No results found."
                parts = []
                for r in results:
                    parts.append(f"**{r.get('title', 'No title')}**\n{r.get('body', '')}\nSource: {r.get('href', '')}")
                return "\n\n".join(parts)
            except Exception as e:
                return f"Search error: {e}"

    return web_search
