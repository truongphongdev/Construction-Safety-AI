import os
import time
import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
# Trigger reload after boto3 install

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
                self._ensure_bucket()
                logger.info(f"Khởi tạo MinIO Client thành công ({endpoint_url}).")
            except Exception as e:
                logger.error(f"Không thể kết nối MinIO: {e}")
        else:
            logger.warning("Chưa cấu hình MinIO credentials đầy đủ.")

    def _ensure_bucket(self):
        """Tự động kiểm tra hoặc tạo bucket nếu chưa có."""
        if self.s3_client:
            try:
                self.s3_client.head_bucket(Bucket=self.bucket_name)
            except Exception:
                try:
                    self.s3_client.create_bucket(Bucket=self.bucket_name)
                    logger.info(f"Đã tạo MinIO bucket: {self.bucket_name}")
                except Exception as err:
                    logger.debug(f"Bucket check info: {err}")

    def upload_file(self, file_path: str, object_key: str, content_type: str = "video/mp4") -> str:
        """
        Upload file từ ổ đĩa lên MinIO bucket (dành cho file video vi phạm .mp4).
        Nếu MinIO không khả dụng, ngay lập tức trả về rỗng để lưu cục bộ.
        """
        if not self.s3_client:
            return ""

        if not os.path.exists(file_path):
            return ""

        try:
            with open(file_path, "rb") as f:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=object_key,
                    Body=f,
                    ContentType=content_type,
                )
            logger.info(f"Đã upload video lên MinIO thành công: {object_key}")
            return object_key
        except Exception as err:
            logger.debug(f"MinIO không kết nối được ({err}), tự động fallback sang lưu cục bộ static.")
            return ""

    def save_and_upload(self, evidence_key: str, image_bytes: bytes) -> str:
        """
        Upload trực tiếp byte buffer lên MinIO bucket (retry 3 lần).
        """
        if not self.s3_client:
            logger.warning("MinIO client chưa được khởi tạo. Không thể upload.")
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

    def get_presigned_url(self, evidence_key: str, expires_in: int = 86400) -> str:
        """Tạo Presigned URL xem video/ảnh trong thời hạn cho trước (mặc định 24h)."""
        if not evidence_key:
            return ""

        if evidence_key.startswith("http") or evidence_key.startswith("/static/"):
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
