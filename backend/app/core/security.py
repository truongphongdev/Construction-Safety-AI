"""
Security helpers — JWT encode/decode, password hashing.
Placeholder: sẽ triển khai khi thêm tính năng authentication.
"""

# from datetime import datetime, timedelta
# from jose import JWTError, jwt
# from passlib.context import CryptContext

SECRET_KEY = "changeme-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 giờ


def create_access_token(data: dict) -> str:
    """Tạo JWT access token. (stub — chưa triển khai)"""
    raise NotImplementedError("JWT chưa được cấu hình. Cài jose & passlib trước.")


def verify_token(token: str) -> dict:
    """Xác thực JWT token. (stub — chưa triển khai)"""
    raise NotImplementedError("JWT chưa được cấu hình.")
