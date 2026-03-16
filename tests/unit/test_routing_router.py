# tests/unit/test_routing_router.py

import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "api-gateway"))

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def transport():
    return ASGITransport(app=app)


APPLY_BODY = {
    "sandbox_report_id": "test-report-123",
    "source_link": "broadband-secondary",
    "target_link": "fiber-primary",
    "traffic_classes": ["voip", "video"],
    "reason": "Test rule",
}


class TestApplyRoutingRule:
    @pytest.mark.asyncio
    async def test_apply_returns_rule_id(self, transport):
        with patch("app.routers.routing.redis_client") as mock_redis:
            mock_redis.hset = AsyncMock()
            mock_redis.xadd = AsyncMock()
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post("/api/v1/routing/apply", json=APPLY_BODY)
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "applied"
        assert "rule_id" in body
        assert len(body["rule_id"]) == 36  # UUID length

    @pytest.mark.asyncio
    async def test_apply_stores_in_redis(self, transport):
        with patch("app.routers.routing.redis_client") as mock_redis:
            mock_redis.hset = AsyncMock()
            mock_redis.xadd = AsyncMock()
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                await ac.post("/api/v1/routing/apply", json=APPLY_BODY)
        # hset called once for the rules hash, xadd called twice (history + steering)
        assert mock_redis.hset.call_count == 1
        assert mock_redis.xadd.call_count == 2

    @pytest.mark.asyncio
    async def test_apply_rule_status_is_active(self, transport):
        with patch("app.routers.routing.redis_client") as mock_redis:
            mock_redis.hset = AsyncMock()
            mock_redis.xadd = AsyncMock()
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post("/api/v1/routing/apply", json=APPLY_BODY)
        assert response.json()["rule"]["status"] == "active"

    @pytest.mark.asyncio
    async def test_apply_missing_required_field_returns_422(self, transport):
        body = dict(APPLY_BODY)
        del body["source_link"]
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post("/api/v1/routing/apply", json=body)
        assert response.status_code == 422


class TestGetActiveRules:
    @pytest.mark.asyncio
    async def test_returns_only_active(self, transport):
        active_rule = json.dumps({
            "id": "abc", "status": "active", "source_link": "a", "target_link": "b",
            "traffic_classes": [], "reason": "r", "created_at": 1700000000.0,
            "sandbox_report_id": "rep-1",
        }).encode()
        rolled_rule = json.dumps({
            "id": "def", "status": "rolled_back", "source_link": "c", "target_link": "d",
            "traffic_classes": [], "reason": "r", "created_at": 1700000001.0,
            "sandbox_report_id": "rep-2",
        }).encode()

        with patch("app.routers.routing.redis_client") as mock_redis:
            mock_redis.hgetall = AsyncMock(return_value={b"abc": active_rule, b"def": rolled_rule})
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/v1/routing/active")

        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 1
        assert body["rules"][0]["id"] == "abc"

    @pytest.mark.asyncio
    async def test_empty_when_no_rules(self, transport):
        with patch("app.routers.routing.redis_client") as mock_redis:
            mock_redis.hgetall = AsyncMock(return_value={})
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/v1/routing/active")
        assert response.json() == {"rules": [], "count": 0}


class TestGetAllRules:
    @pytest.mark.asyncio
    async def test_returns_all_rules_sorted_newest_first(self, transport):
        r1 = json.dumps({"id": "r1", "status": "active", "created_at": 1700000001.0}).encode()
        r2 = json.dumps({"id": "r2", "status": "rolled_back", "created_at": 1700000000.0}).encode()
        with patch("app.routers.routing.redis_client") as mock_redis:
            mock_redis.hgetall = AsyncMock(return_value={b"r1": r1, b"r2": r2})
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/v1/routing/all")
        rules = response.json()["rules"]
        assert len(rules) == 2
        assert rules[0]["id"] == "r1"  # Newer rule first


class TestRollbackRule:
    @pytest.mark.asyncio
    async def test_rollback_active_rule(self, transport):
        rule = json.dumps({
            "id": "rule-1", "status": "active",
            "source_link": "a", "target_link": "b",
        }).encode()
        with patch("app.routers.routing.redis_client") as mock_redis:
            mock_redis.hget = AsyncMock(return_value=rule)
            mock_redis.hset = AsyncMock()
            mock_redis.xadd = AsyncMock()
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.delete("/api/v1/routing/rule-1")
        assert response.status_code == 200
        assert response.json()["status"] == "rolled_back"

    @pytest.mark.asyncio
    async def test_rollback_unknown_rule_returns_404(self, transport):
        with patch("app.routers.routing.redis_client") as mock_redis:
            mock_redis.hget = AsyncMock(return_value=None)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.delete("/api/v1/routing/nonexistent")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_rollback_already_rolled_back_returns_409(self, transport):
        rule = json.dumps({"id": "rule-2", "status": "rolled_back"}).encode()
        with patch("app.routers.routing.redis_client") as mock_redis:
            mock_redis.hget = AsyncMock(return_value=rule)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.delete("/api/v1/routing/rule-2")
        assert response.status_code == 409
