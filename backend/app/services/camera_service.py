from datetime import datetime
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.models.camera import CameraModel
from app.schemas.camera import CameraCreate, CameraUpdate


class CameraService:
    def __init__(self, db: Session):
        self.db = db

    def get_camera(self, camera_id: UUID, include_deleted: bool = False) -> CameraModel | None:
        """Lấy thông tin camera theo ID (mặc định bỏ qua các camera đã soft delete)."""
        query = self.db.query(CameraModel).filter(CameraModel.id == camera_id)
        if not include_deleted:
            query = query.filter(CameraModel.deleted_at.is_(None))
        return query.first()

    def get_cameras(self, limit: int = 20, offset: int = 0, include_deleted: bool = False) -> tuple[list[CameraModel], int]:
        """Lấy danh sách camera phân trang."""
        query = self.db.query(CameraModel)
        if not include_deleted:
            query = query.filter(CameraModel.deleted_at.is_(None))
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        return items, total

    def create_camera(self, obj_in: CameraCreate) -> CameraModel:
        """Tạo thiết bị camera mới."""
        db_camera = CameraModel(
            name=obj_in.name,
            location_desc=obj_in.location_desc,
            ip_address=obj_in.ip_address,
            status=obj_in.status.value if hasattr(obj_in.status, 'value') else obj_in.status,
            ppe_enabled=obj_in.ppe_enabled,
            zone_enabled=obj_in.zone_enabled,
        )
        self.db.add(db_camera)
        self.db.commit()
        self.db.refresh(db_camera)
        return db_camera

    def update_camera(self, camera_id: UUID, obj_in: CameraUpdate) -> CameraModel | None:
        """Cập nhật thông tin thiết bị camera."""
        db_camera = self.get_camera(camera_id)
        if not db_camera:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == 'status' and hasattr(value, 'value'):
                value = value.value
            setattr(db_camera, field, value)

        self.db.commit()
        self.db.refresh(db_camera)
        return db_camera

    def delete_camera(self, camera_id: UUID) -> bool:
        """Soft delete camera (đánh dấu deleted_at thay vì xóa cứng)."""
        db_camera = self.get_camera(camera_id)
        if db_camera:
            db_camera.deleted_at = func.now()
            self.db.commit()
            return True
        return False

    def toggle_features(self, camera_id: UUID, ppe_enabled: bool | None = None, zone_enabled: bool | None = None) -> CameraModel | None:
        """Bật/tắt phát hiện PPE hoặc Vùng cấm cho camera."""
        db_camera = self.get_camera(camera_id)
        if not db_camera:
            return None

        if ppe_enabled is not None:
            db_camera.ppe_enabled = ppe_enabled
        if zone_enabled is not None:
            db_camera.zone_enabled = zone_enabled

        self.db.commit()
        self.db.refresh(db_camera)
        return db_camera

    def create_camera_with_id(self, obj_in: CameraCreate, camera_id: UUID) -> CameraModel:
        """Tạo thiết bị camera mới với ID chỉ định."""
        db_camera = CameraModel(
            id=camera_id,
            name=obj_in.name,
            location_desc=obj_in.location_desc,
            ip_address=obj_in.ip_address,
            status=obj_in.status.value if hasattr(obj_in.status, 'value') else obj_in.status,
            ppe_enabled=obj_in.ppe_enabled,
            zone_enabled=obj_in.zone_enabled,
        )
        self.db.add(db_camera)
        self.db.commit()
        self.db.refresh(db_camera)
        return db_camera
