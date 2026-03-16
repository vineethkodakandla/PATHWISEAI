# services/api-gateway/app/routers/admin.py

from fastapi import APIRouter
from pydantic import BaseModel
import redis.asyncio as redis

from app.config import get_settings

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

settings = get_settings()
redis_client = redis.from_url(settings.redis_url)

LSTM_STATE_KEY = "admin:lstm_enabled"


class LSTMToggleRequest(BaseModel):
    enabled: bool


@router.post("/lstm-toggle")
async def toggle_lstm(request: LSTMToggleRequest):
    """
    Enable or disable live LSTM inference.

    When disabled, the prediction engine stops publishing new forecasts.
    Useful for maintenance windows or A/B testing the model.
    """
    await redis_client.set(LSTM_STATE_KEY, "1" if request.enabled else "0")
    return {
        "status": "ok",
        "lstm_enabled": request.enabled,
    }


@router.get("/lstm-status")
async def get_lstm_status():
    """Return the current LSTM inference toggle state."""
    raw = await redis_client.get(LSTM_STATE_KEY)
    # Default to enabled if not explicitly set
    enabled = raw is None or raw.decode() == "1"
    return {"lstm_enabled": enabled}
