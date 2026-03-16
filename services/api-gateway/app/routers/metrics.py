# services/api-gateway/app/routers/metrics.py

from fastapi import APIRouter
import json
import redis.asyncio as redis

from app.config import get_settings

router = APIRouter(prefix="/api/v1/metrics", tags=["Metrics"])

settings = get_settings()
redis_client = redis.from_url(settings.redis_url)


@router.get("/comparison")
async def get_comparison_metrics():
    """
    Return side-by-side health and forecast metrics for all active links.

    Used by the dashboard to render the multi-link comparison chart.
    Each entry includes the current health score, mean forecasted latency,
    jitter, and packet loss over the 30-second horizon.
    """
    link_ids = await redis_client.smembers("active_links")
    comparison = []

    for link_id_bytes in link_ids:
        link_id = link_id_bytes.decode()
        pred = await redis_client.hgetall(f"prediction:{link_id}")

        if pred:
            latency_fc = json.loads(pred.get(b"latency_forecast", b"[]").decode())
            jitter_fc = json.loads(pred.get(b"jitter_forecast", b"[]").decode())
            pkt_fc = json.loads(pred.get(b"packet_loss_forecast", b"[]").decode())

            comparison.append({
                "link_id": link_id,
                "health_score": float(pred.get(b"health_score", 0)),
                "confidence": float(pred.get(b"confidence", 0)),
                "mean_latency_ms": round(sum(latency_fc) / len(latency_fc), 2) if latency_fc else 0,
                "mean_jitter_ms": round(sum(jitter_fc) / len(jitter_fc), 2) if jitter_fc else 0,
                "mean_packet_loss_pct": round(sum(pkt_fc) / len(pkt_fc), 4) if pkt_fc else 0,
                "timestamp": pred.get(b"timestamp", b"0").decode(),
            })
        else:
            comparison.append({
                "link_id": link_id,
                "health_score": None,
                "confidence": None,
                "mean_latency_ms": None,
                "mean_jitter_ms": None,
                "mean_packet_loss_pct": None,
                "timestamp": None,
            })

    # Sort by health score ascending (worst links first for easy triage)
    comparison.sort(
        key=lambda x: x["health_score"] if x["health_score"] is not None else -1
    )
    return {"links": comparison, "count": len(comparison)}
