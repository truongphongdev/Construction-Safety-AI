from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import hash_password, verify_password, create_access_token, create_refresh_token, decode_token, get_current_user
from app.models.user import UserModel

router = APIRouter(prefix="/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> Any:
    # UserModel chỉ có username, không có email — chỉ query theo username
    user = db.query(UserModel).filter(
        UserModel.username == req.username_or_email
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác."
        )

    if not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác."
        )

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
        }
    }

@router.post("/refresh")
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)) -> Any:
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Loại token không đúng.")

    user_id = payload.get("sub")
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Người dùng không tồn tại.")

    new_access_token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.get("/me")
def get_me(current_user: UserModel = Depends(get_current_user)) -> Any:
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
    }
