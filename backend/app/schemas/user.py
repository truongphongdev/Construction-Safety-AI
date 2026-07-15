from datetime import datetime
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Tên đăng nhập")
    full_name: str | None = Field(None, max_length=100, description="Họ và tên")
    role: UserRole = Field(default=UserRole.ADMIN, description="Vai trò của người dùng")
    is_active: bool = Field(default=True, description="Trạng thái hoạt động")


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100, description="Mật khẩu chưa mã hóa")


class UserUpdate(BaseModel):
    password: str | None = Field(None, min_length=6, max_length=100, description="Mật khẩu mới (nếu có)")
    full_name: str | None = Field(None, max_length=100, description="Họ và tên")
    role: UserRole | None = Field(None, description="Vai trò mới")
    is_active: bool | None = Field(None, description="Trạng thái hoạt động")


class UserOut(UserBase):
    id: UUID = Field(..., description="UUID của người dùng")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserList(BaseModel):
    total: int
    offset: int
    limit: int
    items: list[UserOut]
