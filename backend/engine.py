# backend/engine.py
import asyncio
import random
from datetime import datetime, timezone
from typing import Callable, Any
from google.adk.agents import LlmAgent
from google.adk.runners import InMemoryRunner
from google.genai import types as genai_types
from agents.personas import AGENT_PERSONAS

HISTORY_LIMIT = 20  # keep last N messages in context

class ConversationEngine:
    def __init__(
        self,
        agents: list[LlmAgent],
        broadcast: Callable,
        db: Any,
        delay: int = 20,
        ollama_config: dict | None = None,
    ):
        self._agents = agents
        self._broadcast = broadcast
        self._db = db
        self._delay = delay
        self._ollama_config = ollama_config  # {"model": "ollama/llama3.2", "api_base": "http://..."}
        self._task: asyncio.Task | None = None
        self._running = asyncio.Event()
        self._stopped = False
        self._history: list[dict] = []
        self._topic: str = ""
        self._moderator_input: str = ""
        self._conversation_id: int | None = None

    def update_agents(self, agents: list[LlmAgent], ollama_config: dict | None = None):
        self._agents = agents
        self._ollama_config = ollama_config

    async def start(self, topic: str, llm_provider: str) -> int:
        self._topic = topic
        self._history = []
        self._moderator_input = ""
        self._stopped = False
        self._running.set()
        self._conversation_id = await self._db.create_conversation(
            topic=topic, llm_provider=llm_provider
        )
        await self._broadcast({"type": "topic_set", "topic": topic, "conversation_id": self._conversation_id})
        await self._broadcast({"type": "status", "value": "running"})
        self._task = asyncio.create_task(self._loop())
        return self._conversation_id

    async def pause(self):
        self._running.clear()
        await self._broadcast({"type": "status", "value": "paused"})

    async def resume(self):
        self._running.set()
        await self._broadcast({"type": "status", "value": "running"})

    async def inject(self, moderator_text: str):
        self._moderator_input = moderator_text

    async def stop(self):
        self._stopped = True
        self._running.set()  # unblock if paused
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._conversation_id:
            await self._db.end_conversation(self._conversation_id)
        await self._broadcast({"type": "status", "value": "stopped"})

    def _format_history(self) -> str:
        if not self._history:
            return "(No messages yet — start the conversation!)"
        lines = []
        for msg in self._history[-HISTORY_LIMIT:]:
            lines.append(f"[{msg['agent_name']}]: {msg['text']}")
        return "\n".join(lines)

    async def _run_one_agent(
        self, agent: LlmAgent, topic: str, history: str, moderator_input: str
    ) -> str:
        """Run a single agent turn. Uses direct LiteLLM for Ollama, ADK for everything else."""
        if self._ollama_config:
            return await self._run_one_agent_direct(agent, topic, history, moderator_input)
        return await self._run_one_agent_adk(agent, topic, history, moderator_input)

    async def _run_one_agent_adk(
        self, agent: LlmAgent, topic: str, history: str, moderator_input: str
    ) -> str:
        """ADK path — used for Claude and Gemini."""
        runner = InMemoryRunner(agent=agent, app_name="the_saloon")
        session = await runner.session_service.create_session(
            app_name="the_saloon",
            user_id="engine",
            state={
                "topic": topic,
                "conversation_history": history,
                "moderator_input": moderator_input if moderator_input else "(none)",
            },
        )
        trigger = genai_types.Content(
            role="user",
            parts=[genai_types.Part(text="Continue the conversation in character.")],
        )
        response_text = ""
        async for event in runner.run_async(
            user_id="engine",
            session_id=session.id,
            new_message=trigger,
        ):
            if event.is_final_response() and event.content and event.content.parts:
                response_text = event.content.parts[0].text or ""
        return response_text.strip()

    async def _run_one_agent_direct(
        self, agent: LlmAgent, topic: str, history: str, moderator_input: str
    ) -> str:
        """Direct LiteLLM path — used for Ollama to avoid ADK overhead that confuses local models."""
        import litellm
        persona = AGENT_PERSONAS.get(agent.name, {})
        system_prompt = (
            persona.get("instruction", "")
            .replace("{topic}", topic)
            .replace("{conversation_history}", history)
            .replace("{moderator_input}", moderator_input if moderator_input else "(none)")
        )
        response = await litellm.acompletion(
            model=self._ollama_config["model"],
            api_base=self._ollama_config["api_base"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Continue the conversation in character."},
            ],
        )
        return (response.choices[0].message.content or "").strip()

    async def _loop(self):
        while not self._stopped:
            await self._running.wait()
            if self._stopped:
                break

            shuffled = random.sample(self._agents, len(self._agents))
            moderator_input_this_cycle = self._moderator_input
            self._moderator_input = ""  # clear immediately before any await

            for i, agent in enumerate(shuffled):
                if self._stopped:
                    break
                await self._running.wait()

                # First agent in cycle consumes the moderator input
                current_moderator = moderator_input_this_cycle if i == 0 else ""

                await self._broadcast({"type": "agent_thinking", "agent": agent.name})

                try:
                    history = self._format_history()
                    text = await self._run_one_agent(
                        agent=agent,
                        topic=self._topic,
                        history=history,
                        moderator_input=current_moderator,
                    )
                except Exception as e:
                    print(f"[engine] agent {agent.name} error: {e}", flush=True)
                    await self._broadcast({"type": "agent_thinking", "agent": None})
                    continue

                if not text or "[skip]" in text.lower().strip()[:20]:
                    await self._broadcast({"type": "agent_thinking", "agent": None})
                    continue

                persona = AGENT_PERSONAS.get(agent.name, {})
                agent_name = persona.get("name", agent.name)
                timestamp = datetime.now(timezone.utc).isoformat()

                self._history.append({
                    "agent_id": agent.name,
                    "agent_name": agent_name,
                    "text": text,
                    "timestamp": timestamp,
                })

                await self._broadcast({
                    "type": "message",
                    "agent": agent.name,
                    "agent_name": agent_name,
                    "text": text,
                    "timestamp": timestamp,
                })

                if self._conversation_id:
                    await self._db.save_message(
                        self._conversation_id, agent_id=agent.name, text=text
                    )

                await asyncio.sleep(self._delay)
