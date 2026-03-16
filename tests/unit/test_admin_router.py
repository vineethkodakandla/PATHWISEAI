# tests/unit/test_admin_router.py

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "api-gateway"))

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def transport():
    return ASGITransport(app=app)


class TestLSTMToggle:
    @pytest.mark.asyncio
    async def test_enable_lstm(self, transport):
        with patch("app.routers.admin.redis_client") as mock_redis:
            mock_redis.set = AsyncMock()
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post("/api/v1/admin/lstm-toggle", json={"enabled": True})
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["lstm_enabled"] is True
        mock_redis.set.assert_awaited_once_with("admin:lstm_enabled", "1")

    @pytest.mark.asyncio
    async def test_disable_lstm(self, transport):
        with patch("app.routers.admin.redis_client") as mock_redis:
            mock_redis.set = AsyncMock()
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post("/api/v1/admin/lstm-toggle", json={"enabled": False})
        assert response.status_code == 200
        body = response.json()
        assert body["lstm_enabled"] is False
        mock_redis.set.assert_awaited_once_with("admin:lstm_enabled", "0")

    @pytest.mark.asyncio
    async def test_toggle_missing_body_returns_422(self, transport):
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post("/api/v1/admin/lstm-toggle", json={})
        assert response.status_code == 422


class TestLSTMStatus:
    @pytest.mark.asyncio
    async def test_status_enabled(self, transport):
        with patch("app.routers.admin.redis_client") as mock_redis:
            mock_redis.get = AsyncMock(return_value=b"1")
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/v1/admin/lstm-status")
        assert response.status_code == 200
        assert response.json()["lstm_enabled"] is True

    @pytest.mark.asyncio
    async def test_status_disabled(self, transport):
        with patch("app.routers.admin.redis_client") as mock_redis:
            mock_redis.get = AsyncMock(return_value=b"0")
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/v1/admin/lstm-status")
        assert response.status_code == 200
        assert response.json()["lstm_enabled"] is False

    @pytest.mark.asyncio
    async def test_status_defaults_to_enabled_when_key_absent(self, transport):
        """If the Redis key has never been set, LSTM should be on by default."""
        with patch("app.routers.admin.redis_client") as mock_redis:
            mock_redis.get = AsyncMock(return_value=None)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/v1/admin/lstm-status")
        assert response.status_code == 200
        assert response.json()["lstm_enabled"] is True
