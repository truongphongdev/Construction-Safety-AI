from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.database import Base, engine
import app.models  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(application: FastAPI):
    # Startup: tự động tạo bảng (nếu chưa tồn tại)
    try:
        Base.metadata.create_all(bind=engine)
        print("DATABASE CONNECTION & TABLE CREATION: SUCCESS")
    except Exception as e:
        print(f"DATABASE CONNECTION / TABLE CREATION FAILED: {e}")
    yield
    # Shutdown: dọn dẹp tài nguyên (nếu có)


def create_application() -> FastAPI:
    """Factory function tạo FastAPI app với đầy đủ middleware & router."""
    application = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.PROJECT_DESCRIPTION,
        version=settings.VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────────
    application.include_router(api_router, prefix="/api/v1")

    return application


app = create_application()
