# services/api-gateway/app/routers/telemetry.py

from fastapi import APIRouter, Query
from typing import Optional
import redis.asyncio as redis

from app.config import get_settings

router = APIRouter(prefix="/api/v1/telemetry", tags=["Telemetry"])

settings = get_settings()
redis_client = redis.from_url(settings.redis_url)


def _decode_telemetry_fields(fields: dict) -> dict:
    """Extract and type-cast standard telemetry fields from a Redis Stream entry."""
    return {
        "timestamp": float(fields.get(b"timestamp", 0)),
        "latency_ms": float(fields.get(b"latency_ms", 0)),
        "jitter_ms": float(fields.get(b"jitter_ms", 0)),
        "packet_loss_pct": float(fields.get(b"packet_loss_pct", 0)),
        "bandwidth_util_pct": float(fields.get(b"bandwidth_util_pct", 0)),
        "rtt_ms": float(fields.get(b"rtt_ms", 0)),
    }


@router.get("/links")
async def list_active_links():
    """List all active network links being monitored."""
    link_ids = await redis_client.smembers("active_links")
    return {
        "links": [lid.decode() for lid in link_ids],
        "count": len(link_ids),
    }


@router.get("/{link_id}/raw")
async def get_raw_telemetry(
    link_id: str,
    window: int = Query(60, ge=1, le=3600, description="Number of most recent data points"),
):
    """
    Get raw (unprocessed) telemetry samples for a link.
    Returns the same fields as the standard endpoint but is intended for
    clients that want unprocessed sensor readings without any aggregation.
    """
    raw_points = await redis_client.xrevrange("telemetry:raw", count=window)

    data_points = [
        _decode_telemetry_fields(fields)
        for _, fields in raw_points
        if fields.get(b"link_id", b"").decode() == link_id
    ]
    return {
        "link_id": link_id,
        "data_points": data_points,
        "count": len(data_points),
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
    raw_points = await redis_client.xrevrange(
        "telemetry:raw", count=limit
    )

    data_points = [
        _decode_telemetry_fields(fields)
        for _, fields in raw_points
        if fields.get(b"link_id", b"").decode() == link_id
    ]
    return {
        "link_id": link_id,
        "window": window,
        "data_points": data_points,
        "count": len(data_points),
    }
