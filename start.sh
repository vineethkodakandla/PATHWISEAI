#!/usr/bin/env bash
# ============================================================
#  PathWise AI — Offline Startup Script
#  Runs the full stack locally (no Docker required)
#  Usage: bash start.sh
# ============================================================

set -e

CYAN="\033[0;36m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"
BOLD="\033[1m"

echo ""
echo -e "${CYAN}${BOLD}"
echo "  ██████╗  █████╗ ████████╗██╗  ██╗██╗    ██╗██╗███████╗███████╗"
echo "  ██╔══██╗██╔══██╗╚══██╔══╝██║  ██║██║    ██║██║██╔════╝██╔════╝"
echo "  ██████╔╝███████║   ██║   ███████║██║ █╗ ██║██║███████╗█████╗  "
echo "  ██╔═══╝ ██╔══██║   ██║   ██╔══██║██║███╗██║██║╚════██║██╔══╝  "
echo "  ██║     ██║  ██║   ██║   ██║  ██║╚███╔███╔╝██║███████║███████╗"
echo "  ╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝╚══════╝╚══════╝"
echo -e "${NC}"
echo -e "${CYAN}  AI-Powered SD-WAN with LSTM Network Intelligence${NC}"
echo -e "${GREEN}  Offline Mode — No Docker required${NC}"
echo ""

BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")/frontend" && pwd)"

# ── Check Node ─────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo -e "${RED}[ERROR] Node.js not found. Install from https://nodejs.org${NC}"
    exit 1
fi

# ── Check Python ────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo -e "${RED}[ERROR] Python 3 not found. Install from https://python.org${NC}"
    exit 1
fi

echo -e "${BOLD}Starting services...${NC}"
echo ""

# ── Start Backend ───────────────────────────────────────────
echo -e "${CYAN}[1/2] Starting Backend (FastAPI)...${NC}"
(
    cd "$BACKEND_DIR"
    if [ ! -d ".venv" ]; then
        python3 -m venv .venv
    fi
    source .venv/bin/activate
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    echo -e "${GREEN}  ✓ Backend starting on http://localhost:8000${NC}"
    uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level warning
) &
BACKEND_PID=$!

# Wait for backend to be ready
echo -ne "${YELLOW}  Waiting for backend..."
for i in $(seq 1 20); do
    sleep 1
    if curl -s http://localhost:8000/api/status > /dev/null 2>&1; then
        echo -e " ready!${NC}"
        break
    fi
    echo -n "."
done
echo ""

# ── Start Frontend ──────────────────────────────────────────
echo -e "${CYAN}[2/2] Starting Frontend (React)...${NC}"
(
    cd "$FRONTEND_DIR"
    if [ ! -d "node_modules" ]; then
        echo "  Installing npm packages (first run)..."
        npm install --silent
    fi
    echo -e "${GREEN}  ✓ Frontend starting on http://localhost:3000${NC}"
    REACT_APP_API_URL=http://localhost:8000 npm start
) &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  PathWise AI is running!${NC}"
echo ""
echo -e "  ${BOLD}Frontend:${NC}  http://localhost:3000"
echo -e "  ${BOLD}Backend:${NC}   http://localhost:8000"
echo -e "  ${BOLD}API Docs:${NC}  http://localhost:8000/docs"
echo -e "  ${BOLD}WebSocket:${NC} ws://localhost:8000/ws/live"
echo ""
echo -e "  ${CYAN}Admin Panel:${NC}      http://localhost:3000/admin"
echo -e "  ${CYAN}Network Sim:${NC}      http://localhost:3000"
echo -e "  ${CYAN}Analytics:${NC}        http://localhost:3000/analytics"
echo ""
echo -e "  ${YELLOW}Toggle LSTM in the Admin panel to see the difference!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services"
echo ""

# ── Cleanup on exit ─────────────────────────────────────────
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    pkill -f "uvicorn main:app" 2>/dev/null || true
    echo -e "${GREEN}Stopped.${NC}"
    exit 0
}

trap cleanup INT TERM

wait $BACKEND_PID $FRONTEND_PID
