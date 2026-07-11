"""
test_health.py — Smoke tests cho health check endpoints.
"""

from fastapi.testclient import TestClient


def test_root_returns_ok(client: TestClient):
    """GET /api/v1/ phải trả về status 200 và body có 'status': 'ok'."""
    response = client.get("/api/v1/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_health_endpoint(client: TestClient):
    """GET /api/v1/health phải trả về status 200 và 'status': 'healthy'."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_openapi_docs_available(client: TestClient):
    """Swagger UI phải accessible tại /docs."""
    response = client.get("/docs")
    assert response.status_code == 200
