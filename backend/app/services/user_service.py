import hashlib
import secrets
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.user import UserModel
from app.schemas.user import UserCreate, UserUpdate


def hash_password(password: str) -> str:
    """Mã hóa mật khẩu bằng thuật toán PBKDF2-HMAC-SHA256 với salt ngẫu nhiên 16 bytes."""
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return f"pbkdf2_sha256${salt}${pw_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Xác thực mật khẩu với hash đã lưu."""
    if not stored_hash or "$" not in stored_hash:
        return False
    parts = stored_hash.split("$")
    if len(parts) != 3:
        return False
    _, salt, pw_hash = parts
    computed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return secrets.compare_digest(computed, pw_hash)


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def get_user(self, user_id: UUID) -> UserModel | None:
        """Lấy thông tin người dùng theo ID."""
        return self.db.query(UserModel).filter(UserModel.id == user_id).first()

    def get_user_by_username(self, username: str) -> UserModel | None:
        """Lấy thông tin người dùng theo username."""
        return self.db.query(UserModel).filter(UserModel.username == username).first()

    def get_users(self, limit: int = 20, offset: int = 0) -> tuple[list[UserModel], int]:
        """Lấy danh sách người dùng phân trang."""
        query = self.db.query(UserModel)
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        return items, total

    def create_user(self, obj_in: UserCreate) -> UserModel:
        """Tạo người dùng mới với mật khẩu đã mã hóa."""
        password_hash = hash_password(obj_in.password)
        
        db_user = UserModel(
            username=obj_in.username,
            password_hash=password_hash,
            full_name=obj_in.full_name,
            role=obj_in.role,
            is_active=obj_in.is_active,
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def update_user(self, user_id: UUID, obj_in: UserUpdate) -> UserModel | None:
        """Cập nhật thông tin người dùng."""
        db_user = self.get_user(user_id)
        if not db_user:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["password_hash"] = hash_password(update_data.pop("password"))

        for field, value in update_data.items():
            setattr(db_user, field, value)

        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def delete_user(self, user_id: UUID) -> bool:
        """Xóa cứng người dùng khỏi CSDL."""
        db_user = self.get_user(user_id)
        if db_user:
            self.db.delete(db_user)
            self.db.commit()
            return True
        return False
