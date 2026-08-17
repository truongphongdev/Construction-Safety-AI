"""
main.py — Entry point duy nhất để khởi động server.
Chạy: uvicorn main:app --reload
       hoặc: python main.py
"""

import logging
import uvicorn

# Cấu hình logging cho toàn bộ app
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
# Giảm tiếng ồn từ các thư viện bên thứ ba
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("botocore").setLevel(logging.WARNING)
logging.getLogger("boto3").setLevel(logging.WARNING)
logging.getLogger("s3transfer").setLevel(logging.WARNING)

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
