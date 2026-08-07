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
        
        # Gieo dữ liệu (seed) camera mặc định nếu chưa tồn tại
        from app.core.database import SessionLocal
        from app.models.camera import CameraModel
        import uuid
        db = SessionLocal()
        try:
            default_ids = [
                uuid.UUID("00000000-0000-0000-0000-000000000001"),
            ]
            names = [
                "Camera 01 - Webcam Laptop"
            ]
            locations = [
                "Bàn làm việc"
            ]
            for i, cid in enumerate(default_ids):
                cam = db.query(CameraModel).filter(CameraModel.id == cid).first()
                if not cam:
                    new_cam = CameraModel(
                        id=cid,
                        name=names[i],
                        location_desc=locations[i],
                        ip_address="127.0.0.1",
                        status="ACTIVE"
                    )
                    db.add(new_cam)
            db.commit()
            print("DATABASE SEEDING: SUCCESS")
        except Exception as seed_err:
            print(f"DATABASE SEEDING FAILED: {seed_err}")
        finally:
            db.close()
            
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

    # ── Static Files ──────────────────────────────────────────────────────────
    from pathlib import Path
    from fastapi.staticfiles import StaticFiles
    
    backend_dir = Path(__file__).resolve().parent.parent
    project_root = backend_dir.parent
    
    static_dir = backend_dir / "static"
    video_demo_dir = project_root / "video_demo"
    
    static_dir.mkdir(parents=True, exist_ok=True)
    video_demo_dir.mkdir(parents=True, exist_ok=True)
    
    application.mount("/static/videos", StaticFiles(directory=str(video_demo_dir)), name="static_videos")
    application.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    # ── Routers ───────────────────────────────────────────────────────────────
    application.include_router(api_router, prefix="/api/v1")

    return application


app = create_application()
