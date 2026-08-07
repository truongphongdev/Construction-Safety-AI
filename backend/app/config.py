from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    # ── Project info ──────────────────────────────────────────────────────────
    PROJECT_NAME: str = "Construction Safety AI API"
    PROJECT_DESCRIPTION: str = (
        "Real-time construction site safety monitoring using YOLOv8. "
        "Detects missing PPE, restricted zone intrusion, and fall events."
    )
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── AI / Model ────────────────────────────────────────────────────────────
    MODEL_PATH: str = "ai/weights/best.pt"
    CONFIDENCE_THRESHOLD: float = 0.25
    IOU_THRESHOLD: float = 0.45
    DEVICE: str = "cpu"

    # ── Server ────────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── Database ──────────────────────────────────────────────────────────────
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "construction_safety"
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/construction_safety"

    # ── JWT Authentication ───────────────────────────────────────────────────
    JWT_SECRET: str = "construction_safety_jwt_secret_key_change_in_production_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7


    # ── MinIO S3 Storage ───────────────────────────────────────────
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "construction-safety-evidence"
    MINIO_USE_SSL: bool = False

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Trả về Settings singleton — đọc .env một lần duy nhất."""
    return Settings()

