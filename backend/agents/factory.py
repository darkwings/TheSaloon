# backend/agents/factory.py
from typing import Callable
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from agents.personas import AGENT_PERSONAS

def build_agents(model_string: str, search_tool: Callable, ollama_base_url: str | None = None) -> list[LlmAgent]:
    """Build all 6 LlmAgent instances with the given model and search tool."""
    litellm_kwargs: dict = {"model": model_string}
    is_ollama = model_string.startswith("ollama/")
    if is_ollama and ollama_base_url:
        litellm_kwargs["api_base"] = ollama_base_url

    # Ollama/local models hallucinate tool calls — disable tools for them
    tools = [] if is_ollama else [search_tool]

    agents = []
    for agent_id, persona in AGENT_PERSONAS.items():
        agent = LlmAgent(
            name=agent_id,
            model=LiteLlm(**litellm_kwargs),
            instruction=persona["instruction"],
            description=persona["description"],
            tools=tools,
        )
        agents.append(agent)
    return agents
