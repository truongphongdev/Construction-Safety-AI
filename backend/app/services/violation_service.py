from datetime import datetime
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.models.violation import ViolationModel
from app.schemas.violation import ViolationCreate, ViolationUpdate, ViolationStatus


class ViolationService:
    def __init__(self, db: Session):
        self.db = db

    def get_violation(self, violation_id: UUID, include_deleted: bool = False) -> ViolationModel | None:
        """Lấy thông tin vi phạm theo ID (mặc định bỏ qua các vi phạm đã soft delete)."""
        query = self.db.query(ViolationModel).filter(ViolationModel.id == violation_id)
        if not include_deleted:
            query = query.filter(ViolationModel.deleted_at.is_(None))
        return query.first()

    def get_violations(
        self,
        limit: int = 20,
        offset: int = 0,
        camera_id: UUID | None = None,
        status: ViolationStatus | None = None,
        include_deleted: bool = False,
    ) -> tuple[list[ViolationModel], int]:
        """Lấy danh sách vi phạm phân trang và lọc theo camera_id hoặc status."""
        query = self.db.query(ViolationModel)
        if not include_deleted:
            query = query.filter(ViolationModel.deleted_at.is_(None))
        
        if camera_id is not None:
            query = query.filter(ViolationModel.camera_id == camera_id)
        if status is not None:
            query = query.filter(ViolationModel.status == status)

        total = query.count()
        items = query.order_by(ViolationModel.detected_time.desc()).offset(offset).limit(limit).all()
        return items, total

    def create_violation(self, obj_in: ViolationCreate) -> ViolationModel:
        """Tạo bản ghi vi phạm mới."""
        db_violation = ViolationModel(
            camera_id=obj_in.camera_id,
            detected_time=obj_in.detected_time,
            violation_type=obj_in.violation_type,
            severity_level=obj_in.severity_level,
            worker_code=obj_in.worker_code,
            video_bucket=obj_in.video_bucket,
            video_path=obj_in.video_path,
            image_path=obj_in.image_path,
            status=obj_in.status,
            reviewed_by=obj_in.reviewed_by,
            reviewed_at=obj_in.reviewed_at,
            ai_metadata=obj_in.ai_metadata,
        )
        self.db.add(db_violation)
        self.db.commit()
        self.db.refresh(db_violation)
        return db_violation

    def update_violation(self, violation_id: UUID, obj_in: ViolationUpdate) -> ViolationModel | None:
        """Cập nhật bản ghi vi phạm và kiểm tra tính nhất quán phê duyệt."""
        db_violation = self.get_violation(violation_id)
        if not db_violation:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)

        # Kiểm tra tính nhất quán trước khi lưu vào DB (bảo vệ CheckConstraint chk_review_consistency)
        final_status = update_data.get("status", db_violation.status)
        final_reviewed_by = update_data.get("reviewed_by", db_violation.reviewed_by)
        final_reviewed_at = update_data.get("reviewed_at", db_violation.reviewed_at)

        if final_status == ViolationStatus.PENDING:
            # Nếu người dùng đổi status thành PENDING mà không truyền set null, tự động chuyển về null
            if "reviewed_by" not in update_data:
                update_data["reviewed_by"] = None
                final_reviewed_by = None
            if "reviewed_at" not in update_data:
                update_data["reviewed_at"] = None
                final_reviewed_at = None

        if final_status == ViolationStatus.PENDING and (final_reviewed_by is not None or final_reviewed_at is not None):
            raise ValueError("reviewed_by và reviewed_at phải là null nếu status là PENDING.")

        for field, value in update_data.items():
            setattr(db_violation, field, value)

        self.db.commit()
        self.db.refresh(db_violation)
        return db_violation

    def delete_violation(self, violation_id: UUID) -> bool:
        """Soft delete bản ghi vi phạm."""
        db_violation = self.get_violation(violation_id)
        if db_violation:
            db_violation.deleted_at = func.now()
            self.db.commit()
            return True
        return False
