#!/bin/bash
# ClipForge dev launcher — backend on 5174, frontend on 5173 (proxies /api)
set -e
cd "$(dirname "$0")"

# Activate venv if present
if [ -f .venv/bin/activate ]; then
  source .venv/bin/activate
fi

# Start backend in background
python main.py &
BACKEND_PID=$!
trap "kill $BACKEND_PID 2>/dev/null" EXIT

# Start frontend dev server (foreground)
cd frontend && npm run dev
