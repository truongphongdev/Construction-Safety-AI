"""
conftest.py — Pytest fixtures dùng chung cho toàn bộ test suite.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    """TestClient cho FastAPI app — tái sử dụng trong suốt test session."""
    with TestClient(app) as c:
        yield c
