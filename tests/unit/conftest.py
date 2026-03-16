# tests/unit/conftest.py
# Shared fixtures for API gateway unit tests.
# The root conftest.py already adds the api-gateway service to sys.path,
# so all imports from `app.*` work without per-file path setup.

import pytest
from httpx import ASGITransport
from app.main import app


@pytest.fixture
def transport():
    """ASGI transport wired to the FastAPI app under test."""
    return ASGITransport(app=app)
