import aiosqlite
from datetime import datetime, timezone
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT,
    topic        TEXT NOT NULL,
    llm_provider TEXT NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at     DATETIME
);
CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    agent_id        TEXT NOT NULL,
    text            TEXT NOT NULL,
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

class Database:
    def __init__(self, path: str = "the_saloon.db"):
        self.path = path
        self._conn: aiosqlite.Connection | None = None

    async def init(self):
        self._conn = await aiosqlite.connect(self.path)
        self._conn.row_factory = aiosqlite.Row
        # executescript() issues a COMMIT before running — no explicit commit needed here
        await self._conn.executescript(SCHEMA)

    def _check_conn(self):
        if self._conn is None:
            raise RuntimeError("Database not initialized — call await db.init() first")

    async def close(self):
        if self._conn:
            await self._conn.close()

    async def create_conversation(self, topic: str, llm_provider: str) -> int:
        self._check_conn()
        title = topic[:60] + ("…" if len(topic) > 60 else "")
        async with self._conn.execute(
            "INSERT INTO conversations (title, topic, llm_provider) VALUES (?, ?, ?)",
            (title, topic, llm_provider),
        ) as cursor:
            await self._conn.commit()
            return cursor.lastrowid

    async def end_conversation(self, conv_id: int):
        self._check_conn()
        await self._conn.execute(
            "UPDATE conversations SET ended_at = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), conv_id),
        )
        await self._conn.commit()

    async def list_conversations(self) -> list[dict]:
        self._check_conn()
        async with self._conn.execute(
            "SELECT * FROM conversations ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_conversation(self, conv_id: int) -> dict | None:
        self._check_conn()
        async with self._conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (conv_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def save_message(self, conv_id: int, agent_id: str, text: str):
        self._check_conn()
        await self._conn.execute(
            "INSERT INTO messages (conversation_id, agent_id, text) VALUES (?, ?, ?)",
            (conv_id, agent_id, text),
        )
        await self._conn.commit()

    async def get_messages(self, conv_id: int) -> list[dict]:
        self._check_conn()
        async with self._conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp",
            (conv_id,),
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_setting(self, key: str, default: Any = None) -> Any:
        self._check_conn()
        async with self._conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ) as cursor:
            row = await cursor.fetchone()
            return row["value"] if row else default

    async def set_setting(self, key: str, value: str):
        self._check_conn()
        await self._conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        await self._conn.commit()
