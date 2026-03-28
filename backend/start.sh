#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d ".venv" ]; then
  echo "ERROR: .venv not found. Run: python -m venv .venv && pip install -r requirements.txt"
  exit 1
fi

source .venv/bin/activate

PYTHONWARNINGS=ignore::FutureWarning uvicorn main:app --reload --port 8000
