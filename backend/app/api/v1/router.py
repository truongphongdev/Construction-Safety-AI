from fastapi import APIRouter

from app.api.v1.endpoints import alerts, detection, health

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(detection.router, prefix="/detect", tags=["Detection"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
