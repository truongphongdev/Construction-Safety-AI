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
    ENVIRONMENT: str = "development"   # development | staging | production

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── AI / Model ────────────────────────────────────────────────────────────
    MODEL_PATH: str = "ai/weights/best.pt"
    CONFIDENCE_THRESHOLD: float = 0.5
    IOU_THRESHOLD: float = 0.45
    DEVICE: str = "cpu"            # "cpu" | "cuda" | "mps"

    # ── Server ────────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache
def get_settings() -> Settings:
    """Trả về Settings singleton — đọc .env một lần duy nhất."""
    return Settings()
