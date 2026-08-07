import os
import time
import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class MinioStorageClient:
    """
    MinIO Client sử dụng S3 API (qua boto3).
    """

    def __init__(self):
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self.s3_client = None
        self._init_s3()

    def _init_s3(self):
        if settings.MINIO_ENDPOINT and settings.MINIO_ACCESS_KEY and settings.MINIO_SECRET_KEY:
            try:
                import boto3
                
                from botocore.client import Config
                
                protocol = "https" if settings.MINIO_USE_SSL else "http"
                endpoint_url = f"{protocol}://{settings.MINIO_ENDPOINT}"
                
                self.s3_client = boto3.client(
                    "s3",
                    endpoint_url=endpoint_url,
                    aws_access_key_id=settings.MINIO_ACCESS_KEY,
                    aws_secret_access_key=settings.MINIO_SECRET_KEY,
                    region_name="us-east-1",
                    config=Config(signature_version='s3v4')
                )
                logger.info(f"Khởi tạo MinIO Client thành công ({endpoint_url}).")
            except Exception as e:
                logger.error(f"Không thể kết nối MinIO: {e}")
        else:
            logger.warning("Chưa cấu hình MinIO credentials đầy đủ.")

    def save_and_upload(self, evidence_key: str, image_bytes: bytes) -> str:
        """
        Upload trực tiếp lên MinIO bucket (retry 3 lần).
        """
        if not self.s3_client:
            logger.error("MinIO client chưa được khởi tạo. Không thể upload.")
            return ""

        # Try uploading to MinIO
        for attempt in range(1, 4):
            try:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=evidence_key,
                    Body=image_bytes,
                    ContentType="image/jpeg",
                )
                logger.info(f"Đã upload MinIO thành công key: {evidence_key}")
                return evidence_key
            except Exception as err:
                logger.warning(f"Lần {attempt} upload MinIO thất bại cho {evidence_key}: {err}")
                time.sleep(0.5 * attempt)

        logger.error(f"Upload MinIO thất bại hoàn toàn sau 3 lần thử: {evidence_key}")
        return ""

    def get_presigned_url(self, evidence_key: str, expires_in: int = 3600) -> str:
        """Tạo Presigned URL xem ảnh trong thời hạn cho trước (mặc định 1h)."""
        if not evidence_key:
            return ""

        if evidence_key.startswith("http"):
            return evidence_key

        if self.s3_client:
            try:
                url = self.s3_client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket_name, "Key": evidence_key},
                    ExpiresIn=expires_in,
                )
                
                # Rewrite URL for frontend access if backend is running inside docker network
                if "http://minio:9000" in url:
                    url = url.replace("http://minio:9000", "http://localhost:9002")
                    
                return url
            except Exception as e:
                logger.error(f"Lỗi tạo presigned URL cho {evidence_key}: {e}")

        return ""

# Global MinIO Singleton
minio_storage = MinioStorageClient()
