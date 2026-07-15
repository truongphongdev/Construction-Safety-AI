from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Project info ──────────────────────────────────────────────────────────
    PROJECT_NAME: str = "Construction Safety AI API"
    PROJECT_DESCRIPTION: str = (
        "Real-time construction site safety monitoring using YOLOv8. "
        "Detects missing PPE, restricted zone intrusion, and fall events."
    )
    VERSION: str = "0.1.0"
    ENVIRONMENT: str   # development | staging | production

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str]

    # ── AI / Model ────────────────────────────────────────────────────────────
    MODEL_PATH: str
    CONFIDENCE_THRESHOLD: float
    IOU_THRESHOLD: float
    DEVICE: str            # "cpu" | "cuda" | "mps"

    # ── Server ────────────────────────────────────────────────────────────────
    HOST: str
    PORT: int

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Trả về Settings singleton — đọc .env một lần duy nhất."""
    return Settings()
