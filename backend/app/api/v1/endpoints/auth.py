from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import hash_password, verify_password
from app.models.user import UserModel

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    username: str = Field(..., description="Tên đăng nhập hoặc email")
    password: str = Field(..., description="Mật khẩu")


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Tên đăng nhập")
    password: str = Field(..., min_length=6, description="Mật khẩu (tối thiểu 6 ký tự)")
    full_name: str | None = Field(None, max_length=100, description="Họ và tên")
    role: str = Field("ADMIN", description="Vai trò người dùng (ADMIN, SUPER_ADMIN)")


class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str | None
    role: str


class AuthResponse(BaseModel):
    success: bool = True
    message: str
    user: UserResponse


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)) -> Any:
    """Đăng ký tài khoản người dùng mới (lưu vào database)."""
    # Chuẩn hóa username (bỏ khoảng trắng)
    clean_username = req.username.strip().lower()
    if not clean_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập không được để trống.",
        )

    # Kiểm tra xem tên đăng nhập đã tồn tại chưa
    existing_user = db.query(UserModel).filter(
        UserModel.username == clean_username
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập '{clean_username}' đã tồn tại trong hệ thống.",
        )

    # Tạo người dùng mới
    hashed_pwd = hash_password(req.password)
    new_user = UserModel(
        username=clean_username,
        password_hash=hashed_pwd,
        full_name=req.full_name.strip() if req.full_name else clean_username,
        role=req.role if req.role in ["ADMIN", "SUPER_ADMIN"] else "ADMIN",
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "success": True,
        "message": "Đăng ký tài khoản thành công!",
        "user": {
            "id": str(new_user.id),
            "username": new_user.username,
            "full_name": new_user.full_name,
            "role": new_user.role,
        },
    }


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> Any:
    """Đăng nhập hệ thống (xác thực trực tiếp qua database)."""
    clean_username = req.username.strip().lower()
    
    user = db.query(UserModel).filter(
        UserModel.username == clean_username
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản này đã bị tạm khóa.",
        )

    if not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác.",
        )

    return {
        "success": True,
        "message": "Đăng nhập thành công!",
        "user": {
            "id": str(user.id),
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
        },
    }

