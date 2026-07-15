from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import DbDep
from app.schemas.violation import ViolationCreate, ViolationList, ViolationOut, ViolationStatus, ViolationUpdate
from app.services.violation_service import ViolationService
from app.services.camera_service import CameraService
from app.services.user_service import UserService

router = APIRouter()


@router.post(
    "/",
    response_model=ViolationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo bản ghi vi phạm mới",
)
def create_violation(db: DbDep, violation_in: ViolationCreate):
    violation_service = ViolationService(db)
    camera_service = CameraService(db)
    user_service = UserService(db)

    # Kiểm tra xem camera_id có hợp lệ và tồn tại không
    if not camera_service.get_camera(violation_in.camera_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Camera ID '{violation_in.camera_id}' không tồn tại hoặc đã bị xóa.",
        )

    # Kiểm tra xem reviewed_by có tồn tại không (nếu được truyền)
    if violation_in.reviewed_by is not None:
        if not user_service.get_user(violation_in.reviewed_by):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Người dùng phê duyệt (User ID) '{violation_in.reviewed_by}' không tồn tại.",
            )

    try:
        return violation_service.create_violation(violation_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=ViolationList,
    summary="Lấy danh sách vi phạm",
)
def get_violations(
    db: DbDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    camera_id: UUID | None = Query(None, description="Lọc theo ID camera"),
    status: ViolationStatus | None = Query(None, description="Lọc theo trạng thái phê duyệt"),
    include_deleted: bool = Query(default=False, description="Bao gồm cả các vi phạm đã bị xóa mềm"),
):
    service = ViolationService(db)
    items, total = service.get_violations(
        limit=limit,
        offset=offset,
        camera_id=camera_id,
        status=status,
        include_deleted=include_deleted,
    )
    return ViolationList(total=total, offset=offset, limit=limit, items=items)


@router.get(
    "/{violation_id}",
    response_model=ViolationOut,
    summary="Lấy chi tiết vi phạm",
)
def get_violation(db: DbDep, violation_id: UUID, include_deleted: bool = Query(default=False)):
    service = ViolationService(db)
    violation = service.get_violation(violation_id, include_deleted=include_deleted)
    if not violation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bản ghi vi phạm không tồn tại hoặc đã bị xóa.",
        )
    return violation


@router.put(
    "/{violation_id}",
    response_model=ViolationOut,
    summary="Cập nhật bản ghi vi phạm",
)
def update_violation(db: DbDep, violation_id: UUID, violation_in: ViolationUpdate):
    violation_service = ViolationService(db)
    camera_service = CameraService(db)
    user_service = UserService(db)

    # Đảm bảo record tồn tại
    if not violation_service.get_violation(violation_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bản ghi vi phạm không tồn tại hoặc đã bị xóa.",
        )

    # Xác thực camera_id nếu được cập nhật
    if violation_in.camera_id is not None:
        if not camera_service.get_camera(violation_in.camera_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Camera ID '{violation_in.camera_id}' không tồn tại hoặc đã bị xóa.",
            )

    # Xác thực reviewed_by nếu được cập nhật
    if violation_in.reviewed_by is not None:
        if not user_service.get_user(violation_in.reviewed_by):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Người dùng phê duyệt (User ID) '{violation_in.reviewed_by}' không tồn tại.",
            )

    try:
        violation = violation_service.update_violation(violation_id, violation_in)
        return violation
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/{violation_id}",
    summary="Xóa bản ghi vi phạm (soft delete)",
)
def delete_violation(db: DbDep, violation_id: UUID):
    service = ViolationService(db)
    deleted = service.delete_violation(violation_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bản ghi vi phạm không tồn tại hoặc đã bị xóa trước đó.",
        )
    return {"message": "Bản ghi vi phạm đã được xóa mềm thành công."}
