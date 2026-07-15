from uuid import UUID
from sqlalchemy.orm import Session
from app.models.user import UserModel
from app.schemas.user import UserCreate, UserUpdate


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
        """Tạo người dùng mới."""
        # Stub password hashing - Thực tế sẽ dùng thư viện mã hóa bcrypt/passlib
        password_hash = f"hashed_{obj_in.password}"
        
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
            update_data["password_hash"] = f"hashed_{update_data.pop('password')}"

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
