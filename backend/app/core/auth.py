import time
import json
import base64
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.database import get_db
from app.models.user import UserModel

try:
    import jwt
    HAS_JWT = True
except ImportError:
    HAS_JWT = False

logger = logging.getLogger(__name__)
settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def hash_password(password: str) -> str:
    """Mã hóa mật khẩu bằng SHA256 HMAC với secret làm salt."""
    return hmac.HMAC(
        settings.JWT_SECRET.encode("utf-8"),
        password.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hmac.compare_digest(hash_password(plain_password), hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire_dt = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": int(expire_dt.timestamp()), "type": "access"})

    if HAS_JWT:
        return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    # Fallback JSON Base64 token
    payload_str = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode().rstrip("=")
    signature = hmac.HMAC(settings.JWT_SECRET.encode(), payload_str.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{payload_str}.{signature}"

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire_dt = datetime.now(timezone.utc) + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": int(expire_dt.timestamp()), "type": "refresh"})

    if HAS_JWT:
        return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    payload_str = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode().rstrip("=")
    signature = hmac.HMAC(settings.JWT_SECRET.encode(), payload_str.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{payload_str}.{signature}"

def decode_token(token: str) -> dict:
    if HAS_JWT:
        try:
            return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token đã hết hạn.")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ.")

    # Fallback decode
    try:
        parts = token.split(".")
        if len(parts) != 2:
            raise ValueError()
        payload_str, signature = parts
        expected_sig = hmac.HMAC(settings.JWT_SECRET.encode(), payload_str.encode(), hashlib.sha256).hexdigest()[:16]
        if not hmac.compare_digest(signature, expected_sig):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chữ ký token không hợp lệ.")

        padded = payload_str + "=" * (-len(payload_str) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
        exp = data.get("exp", 0)
        if time.time() > exp:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token đã hết hạn.")
        return data
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ.")

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserModel:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Thiếu authentication token.")

    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Payload token không hợp lệ.")

    user = db.query(UserModel).filter(UserModel.id == user_id, UserModel.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Người dùng không tồn tại hoặc đã bị khóa.")

    return user
