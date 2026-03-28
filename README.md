# The Saloon

A local web app where 6 AI agents with distinct personalities debate endlessly in a pixel-art western saloon. You are the moderator.

## Characters

| Name | Archetype | Color |
|------|-----------|-------|
| Prof. Isacco Quark | The Scientist | 🔵 |
| Bobby Ray Buster | The Redneck | 🟠 |
| Comrade Karl Rosso | The Communist | 🔴 |
| Marco Buonsenso | The Center-Right | 🟢 |
| Gigi Bellavita | The Simple One | 🟡 |
| Zoe Futura | The Young Idealist | 🩷 |

## Requirements

- Python 3.11+
- Node.js 18+
- An LLM API key (Claude, Gemini, or local Ollama)
- A search API key (Tavily recommended, or use DuckDuckGo for free)

## Quick Start

### 1. Clone and configure

```bash
git clone <repo>
cd the-saloon
cp .env.example .env
# Edit .env with your API keys
```

### 2. Backend

First install:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Then start (every time):

```bash
./backend/start.sh
```

The script activates the virtualenv and launches uvicorn on port 8000.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — type a topic and press START.

## LLM Configuration

Edit `.env` to choose your provider:

### Claude (recommended)

```env
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```

### Gemini

```env
LLM_PROVIDER=gemini
GOOGLE_API_KEY=AIza...
```

### Ollama (local, no API key)

First install Ollama and pull a model:

```bash
ollama pull llama3.2
```

Then:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

## Search Configuration

### Tavily (recommended)

```env
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=tvly-...
```

Get a free API key (1000 searches/month) at https://tavily.com

### DuckDuckGo (no API key)

```env
SEARCH_PROVIDER=duckduckgo
```

## Runtime Settings

All settings can be changed at runtime via the ⚙️ Settings page — no restart needed.

- **LLM Provider**: switch between Claude, Gemini, Ollama
- **Search Provider**: switch between Tavily and DuckDuckGo
- **Conversation Speed**: 5–60 second delay between agent turns

## Data

All conversations are stored locally in `backend/the_saloon.db` (SQLite). No data is sent to external servers beyond LLM and search API calls.
