from fastapi import APIRouter

from app.api.v1.endpoints import detection, health, users, cameras, violations

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(detection.router, prefix="/detect", tags=["Detection"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(cameras.router, prefix="/cameras", tags=["Cameras"])
api_router.include_router(violations.router, prefix="/violations", tags=["Violations"])


