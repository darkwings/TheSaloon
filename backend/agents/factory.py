# backend/agents/factory.py
from typing import Callable
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from agents.personas import AGENT_PERSONAS

def build_agents(model_string: str, search_tool: Callable) -> list[LlmAgent]:
    """Build all 6 LlmAgent instances with the given model and search tool."""
    agents = []
    for agent_id, persona in AGENT_PERSONAS.items():
        agent = LlmAgent(
            name=agent_id,
            model=LiteLlm(model=model_string),
            instruction=persona["instruction"],
            description=persona["description"],
            tools=[search_tool],
        )
        agents.append(agent)
    return agents
