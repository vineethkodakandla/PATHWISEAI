#!/usr/bin/env bash
# PathWise AI – Backend Startup Script
set -e

echo "╔══════════════════════════════════════╗"
echo "║  PathWise AI  –  Backend (Offline)   ║"
echo "╚══════════════════════════════════════╝"

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python 3 not found. Please install Python 3.9+."
    exit 1
fi

# Create venv if not present
if [ ! -d ".venv" ]; then
    echo "[*] Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate

echo "[*] Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo "[*] Starting PathWise AI backend on http://localhost:8000"
echo "[*] WebSocket: ws://localhost:8000/ws/live"
echo "[*] API docs:  http://localhost:8000/docs"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000
