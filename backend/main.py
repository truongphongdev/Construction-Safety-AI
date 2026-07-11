"""
main.py — Entry point duy nhất để khởi động server.
Chạy: uvicorn main:app --reload
       hoặc: python main.py
"""

import uvicorn
from app.main import app  # noqa: F401 — export app cho uvicorn

if __name__ == "__main__":
    from app.config import get_settings

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
    )
