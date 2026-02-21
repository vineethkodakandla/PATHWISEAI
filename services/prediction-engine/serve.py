# services/prediction-engine/serve.py

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager

import numpy as np
import redis.asyncio as redis
import torch
from fastapi import FastAPI

from model.feature_engineering import FeatureEngineer
from model.lstm_network import PathWiseLSTM

# Global state
model: PathWiseLSTM | None = None
feature_eng: FeatureEngineer | None = None
redis_client: redis.Redis | None = None

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CHECKPOINT = os.getenv("MODEL_PATH", "checkpoints/best_model.pt")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, feature_eng, redis_client

    # Load model — use random weights if no checkpoint exists yet
    model = PathWiseLSTM()
    if os.path.exists(CHECKPOINT):
        checkpoint = torch.load(CHECKPOINT, map_location="cpu")
        model.load_state_dict(checkpoint["model_state_dict"])
        print(f"Loaded checkpoint from {CHECKPOINT}")
    else:
        print(f"No checkpoint at {CHECKPOINT} — running with untrained weights")
    model.eval()

    feature_eng = FeatureEngineer()
    redis_client = redis.from_url(REDIS_URL)

    # Start background prediction loop
    asyncio.create_task(prediction_loop())

    yield

    await redis_client.aclose()


app = FastAPI(title="PathWise Prediction Engine", lifespan=lifespan)


async def prediction_loop():
    """
    Continuous prediction: every second, fetch latest telemetry
    points per link, run inference, publish predictions.

    This runs as a background coroutine, not triggered by HTTP.
    """
    while True:
        try:
            # Get all active link IDs from Redis
            link_ids = await redis_client.smembers("active_links")
            num_links = max(len(link_ids), 1)

            # Fetch enough points to cover 60 per link across all links
            raw_points = await redis_client.xrevrange(
                "telemetry:raw", count=60 * num_links * 2
            )

            for link_id_bytes in link_ids:
                link_id = link_id_bytes.decode()

                if len(raw_points) < 60:
                    continue  # Not enough data yet

                # Build feature tensor
                window = build_feature_window(raw_points, link_id)
                if window is None:
                    continue

                # Inference
                with torch.no_grad():
                    x = torch.tensor(window).unsqueeze(0)  # (1, 60, 13)
                    preds, confidence = model(x)

                # Compute health score (0-100, higher is healthier)
                health_score = compute_health_score(preds, confidence)

                # Publish prediction to Redis for consumers
                # Bug fix: use json.dumps() not list.__str__()
                await redis_client.hset(f"prediction:{link_id}", mapping={
                    "latency_forecast": json.dumps(preds["latency"][0].tolist()),
                    "jitter_forecast": json.dumps(preds["jitter"][0].tolist()),
                    "packet_loss_forecast": json.dumps(preds["packet_loss"][0].tolist()),
                    "confidence": float(confidence[0]),
                    "health_score": health_score,
                    "timestamp": str(time.time()),
                })

                # Publish event if degradation predicted
                if health_score < 50:
                    await redis_client.xadd("alerts:degradation", {
                        "link_id": link_id,
                        "health_score": str(health_score),
                        "confidence": str(float(confidence[0])),
                    })

        except Exception as e:
            print(f"Prediction loop error: {e}")

        await asyncio.sleep(1.0)


def compute_health_score(preds: dict, confidence: torch.Tensor) -> float:
    """
    Composite health score (0-100):
    - Latency: <30ms = 100, >200ms = 0  (weight: 0.4)
    - Jitter: <5ms = 100, >50ms = 0     (weight: 0.3)
    - Packet Loss: <0.1% = 100, >5% = 0 (weight: 0.3)

    Averaged over the 30-second horizon, scaled by confidence.
    """
    lat = preds["latency"][0].mean().item()
    jit = preds["jitter"][0].mean().item()
    pkt = preds["packet_loss"][0].mean().item()
    conf = confidence[0].item()

    lat_score = max(0, min(100, 100 * (1 - (lat - 30) / 170)))
    jit_score = max(0, min(100, 100 * (1 - (jit - 5) / 45)))
    pkt_score = max(0, min(100, 100 * (1 - (pkt - 0.1) / 4.9)))

    raw_score = 0.4 * lat_score + 0.3 * jit_score + 0.3 * pkt_score
    return round(raw_score * (0.5 + 0.5 * conf), 1)  # Discount by confidence


def build_feature_window(raw_points: list, link_id: str):
    """Convert Redis Stream entries to feature-engineered numpy array."""
    import pandas as pd

    rows = []
    for entry_id, fields in reversed(raw_points):
        if fields.get(b"link_id", b"").decode() == link_id:
            rows.append({
                "time": float(fields.get(b"timestamp", 0)),
                "latency_ms": float(fields.get(b"latency_ms", 0)),
                "jitter_ms": float(fields.get(b"jitter_ms", 0)),
                "packet_loss_pct": float(fields.get(b"packet_loss_pct", 0)),
                "bandwidth_util_pct": float(fields.get(b"bandwidth_util_pct", 0)),
                "rtt_ms": float(fields.get(b"rtt_ms", 0)),
            })

    if len(rows) < 60:
        return None

    df = pd.DataFrame(rows[:60])
    df = feature_eng.compute_features(df)

    feature_cols = [
        "latency_ms", "jitter_ms", "packet_loss_pct",
        "bandwidth_util_pct", "rtt_ms",
        "mean_latency_30s", "std_latency_30s", "mean_jitter_30s",
        "ema_latency", "ema_packet_loss",
        "d_latency", "d_jitter", "d_packet_loss",
    ]
    window = df[feature_cols].values.astype(np.float32)
    return window
