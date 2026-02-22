# services/api-gateway/app/routers/telemetry.py

import redis.asyncio as redis
from fastapi import APIRouter, Query

from app.config import get_settings

router = APIRouter(prefix="/api/v1/telemetry", tags=["Telemetry"])

settings = get_settings()
redis_client = redis.from_url(settings.redis_url)


@router.get("/links")
async def list_active_links():
    """List all active network links being monitored."""
    link_ids = await redis_client.smembers("active_links")
    return {
        "links": [lid.decode() for lid in link_ids],
        "count": len(link_ids),
    }


@router.get("/{link_id}")
async def get_telemetry(
    link_id: str,
    window: str = Query("60s", description="Time window (e.g., 60s, 5m, 1h)"),
    limit: int = Query(60, ge=1, le=3600, description="Maximum data points"),
):
    """
    Get raw telemetry data for a specific link.

    Returns the most recent data points within the specified window.
    """
    # The stream is shared across all links; fetch enough entries to
    # guarantee `limit` points per link (num_links × limit × 2 for safety).
    num_links = max(await redis_client.scard("active_links"), 1)
    raw_points = await redis_client.xrevrange(
        "telemetry:raw", count=limit * num_links * 2
    )

    data_points = []
    for entry_id, fields in raw_points:
        if fields.get(b"link_id", b"").decode() == link_id:
            data_points.append({
                "timestamp": float(fields.get(b"timestamp", 0)),
                "latency_ms": float(fields.get(b"latency_ms", 0)),
                "jitter_ms": float(fields.get(b"jitter_ms", 0)),
                "packet_loss_pct": float(fields.get(b"packet_loss_pct", 0)),
                "bandwidth_util_pct": float(fields.get(b"bandwidth_util_pct", 0)),
                "rtt_ms": float(fields.get(b"rtt_ms", 0)),
            })
            if len(data_points) >= limit:
                break

    return {
        "link_id": link_id,
        "window": window,
        "data_points": data_points,
        "count": len(data_points),
    }
