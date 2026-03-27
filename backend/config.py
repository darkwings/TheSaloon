import os
from dotenv import load_dotenv

load_dotenv()

PROVIDER_MODELS = {
    "claude": "anthropic/claude-sonnet-4-6",
    "gemini": "gemini/gemini-2.5-flash",
    "ollama": "ollama/{model}",
}

class Settings:
    def __init__(self, db):
        self._db = db

    async def get(self, key: str, default: str | None = None) -> str | None:
        """DB value overrides .env. Returns default if neither exists."""
        db_value = await self._db.get_setting(key)
        if db_value is not None:
            return db_value
        return os.getenv(key, default)

    async def get_model_string(self) -> str:
        provider = await self.get("LLM_PROVIDER", default="claude")
        template = PROVIDER_MODELS.get(provider, PROVIDER_MODELS["claude"])
        if provider == "ollama":
            model_name = await self.get("OLLAMA_MODEL", default="llama3.2")
            return template.format(model=model_name)
        return template

    async def get_delay(self) -> int:
        val = await self.get("CONVERSATION_DELAY_SECONDS", default="20")
        return int(val)

    async def get_search_provider(self) -> str:
        return await self.get("SEARCH_PROVIDER", default="tavily")
