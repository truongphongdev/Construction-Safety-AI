from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import DbDep
from app.schemas.camera import CameraCreate, CameraList, CameraOut, CameraUpdate, CameraToggle
from app.services.camera_service import CameraService

router = APIRouter()


@router.post(
    "",
    response_model=CameraOut,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký camera mới",
)
@router.post(
    "/",
    response_model=CameraOut,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_camera(db: DbDep, camera_in: CameraCreate):
    service = CameraService(db)
    return service.create_camera(camera_in)


@router.get(
    "",
    response_model=CameraList,
    summary="Lấy danh sách camera",
)
@router.get(
    "/",
    response_model=CameraList,
    include_in_schema=False,
)
def get_cameras(
    db: DbDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    include_deleted: bool = Query(default=False, description="Bao gồm cả các camera đã bị xóa mềm"),
):
    service = CameraService(db)
    items, total = service.get_cameras(limit=limit, offset=offset, include_deleted=include_deleted)
    return CameraList(total=total, offset=offset, limit=limit, items=items)


@router.get(
    "/{camera_id}",
    response_model=CameraOut,
    summary="Lấy chi tiết camera",
)
def get_camera(db: DbDep, camera_id: UUID, include_deleted: bool = Query(default=False)):
    service = CameraService(db)
    camera = service.get_camera(camera_id, include_deleted=include_deleted)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera không tồn tại hoặc đã bị xóa.",
        )
    return camera


@router.put(
    "/{camera_id}",
    response_model=CameraOut,
    summary="Cập nhật thông tin camera",
)
def update_camera(db: DbDep, camera_id: UUID, camera_in: CameraUpdate):
    service = CameraService(db)
    camera = service.update_camera(camera_id, camera_in)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera không tồn tại hoặc đã bị xóa.",
        )
    return camera


@router.patch(
    "/{camera_id}/toggle",
    response_model=CameraOut,
    summary="Bật/tắt tính năng PPE hoặc Vùng cấm cho camera",
)
def toggle_camera(db: DbDep, camera_id: UUID, toggle_in: CameraToggle):
    service = CameraService(db)
    camera = service.toggle_features(
        camera_id, 
        ppe_enabled=toggle_in.ppe_enabled, 
        zone_enabled=toggle_in.zone_enabled
    )
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera không tồn tại hoặc đã bị xóa.",
        )
    return camera


@router.delete(
    "/{camera_id}",
    summary="Xóa camera (soft delete)",
)
def delete_camera(db: DbDep, camera_id: UUID):
    service = CameraService(db)
    deleted = service.delete_camera(camera_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera không tồn tại hoặc đã bị xóa trước đó.",
        )
    return {"message": "Camera đã được xóa mềm thành công."}

