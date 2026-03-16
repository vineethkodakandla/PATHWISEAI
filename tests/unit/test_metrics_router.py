# tests/unit/test_metrics_router.py

import json
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
from app.main import app


def _pred_hash(health_score, latency, jitter, pkt_loss):
    """Build a bytes-keyed Redis hgetall response for a prediction hash."""
    return {
        b"health_score": str(health_score).encode(),
        b"confidence": b"0.85",
        b"latency_forecast": json.dumps(latency).encode(),
        b"jitter_forecast": json.dumps(jitter).encode(),
        b"packet_loss_forecast": json.dumps(pkt_loss).encode(),
        b"timestamp": b"1700000000.0",
    }


class TestComparisonMetrics:
    @pytest.mark.asyncio
    async def test_returns_all_active_links(self, transport):
        link_ids = {b"fiber-primary", b"broadband-secondary"}
        preds = {
            "fiber-primary": _pred_hash(85.0, [12.0, 13.0], [1.0, 1.1], [0.01, 0.02]),
            "broadband-secondary": _pred_hash(42.0, [55.0, 60.0], [5.0, 6.0], [1.5, 2.0]),
        }

        async def fake_hgetall(key):
            link = key.split(":")[1]
            return preds.get(link, {})

        with patch("app.routers.metrics.redis_client") as mock_redis:
            mock_redis.smembers = AsyncMock(return_value=link_ids)
            mock_redis.hgetall = AsyncMock(side_effect=fake_hgetall)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/v1/metrics/comparison")

        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 2
        names = {entry["link_id"] for entry in body["links"]}
        assert names == {"fiber-primary", "broadband-secondary"}

    @pytest.mark.asyncio
    async def test_sorted_by_health_score_ascending(self, transport):
        """Worst link (lowest health) should appear first."""
        link_ids = {b"fiber-primary", b"broadband-secondary", b"satellite-backup"}
        scores = {"fiber-primary": 90.0, "broadband-secondary": 40.0, "satellite-backup": 60.0}

        async def fake_hgetall(key):
            link = key.split(":")[1]
            score = scores.get(link, 50.0)
            return _pred_hash(score, [10.0], [1.0], [0.01])

        with patch("app.routers.metrics.redis_client") as mock_redis:
            mock_redis.smembers = AsyncMock(return_value=link_ids)
            mock_redis.hgetall = AsyncMock(side_effect=fake_hgetall)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/v1/metrics/comparison")

        links = response.json()["links"]
        health_scores = [e["health_score"] for e in links]
        assert health_scores == sorted(health_scores)

    @pytest.mark.asyncio
    async def test_no_active_links(self, transport):
        with patch("app.routers.metrics.redis_client") as mock_redis:
            mock_redis.smembers = AsyncMock(return_value=set())
            mock_redis.hgetall = AsyncMock(return_value={})
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/v1/metrics/comparison")
        assert response.status_code == 200
        assert response.json() == {"links": [], "count": 0}

    @pytest.mark.asyncio
    async def test_link_with_no_prediction_has_none_fields(self, transport):
        """A link that has no prediction data yet should show null fields."""
        with patch("app.routers.metrics.redis_client") as mock_redis:
            mock_redis.smembers = AsyncMock(return_value={b"new-link"})
            mock_redis.hgetall = AsyncMock(return_value={})  # No prediction stored
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/v1/metrics/comparison")
        entry = response.json()["links"][0]
        assert entry["health_score"] is None
        assert entry["mean_latency_ms"] is None
