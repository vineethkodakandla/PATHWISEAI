# services/api-gateway/app/main.py

import redis.asyncio as _redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.routers import telemetry, predictions, steering, sandbox, policies, admin, metrics, routing
from app.websocket.scoreboard import ScoreboardManager

_settings = get_settings()
scoreboard = ScoreboardManager(redis_url=_settings.redis_url)
_status_redis = _redis.from_url(_settings.redis_url)

@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    task = asyncio.create_task(scoreboard.broadcast_loop())
    yield
    task.cancel()

app = FastAPI(
    title="PathWise AI API",
    version="1.0.0",
    description="AI-Powered SD-WAN Management Platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routes
app.include_router(telemetry.router)     # GET /api/v1/telemetry/{link_id}
app.include_router(predictions.router)    # GET /api/v1/predictions/{link_id}
app.include_router(steering.router)       # POST /api/v1/steering/execute
app.include_router(sandbox.router)        # POST /api/v1/sandbox/validate
app.include_router(policies.router)       # POST /api/v1/policies/intent
app.include_router(admin.router)          # GET/POST /api/v1/admin/lstm-*
app.include_router(metrics.router)        # GET /api/v1/metrics/comparison
app.include_router(routing.router)        # GET/POST/DELETE /api/v1/routing/*


@app.get("/api/v1/status", tags=["Health"])
async def system_status():
    """System-wide health check: Redis connectivity and service state."""
    try:
        await _status_redis.ping()
        redis_ok = True
        link_count = len(await _status_redis.smembers("active_links"))
        lstm_raw = await _status_redis.get(admin.LSTM_STATE_KEY)
        lstm_enabled = lstm_raw is None or lstm_raw.decode() == "1"
    except Exception:
        redis_ok = False
        link_count = 0
        lstm_enabled = False

    return {
        "status": "healthy" if redis_ok else "degraded",
        "version": app.version,
        "services": {
            "redis": "connected" if redis_ok else "unreachable",
            "prediction_engine": "active" if redis_ok else "unknown",
        },
        "lstm_enabled": lstm_enabled,
        "active_links": link_count,
    }

# WebSocket
@app.websocket("/ws/scoreboard")
async def scoreboard_ws(ws):
    await scoreboard.connect(ws)
    try:
        while True:
            await ws.receive_text()  # Keep connection alive
    except:
        await scoreboard.disconnect(ws)
