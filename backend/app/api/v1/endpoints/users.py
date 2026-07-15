from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import DbDep
from app.schemas.user import UserCreate, UserList, UserOut, UserUpdate
from app.services.user_service import UserService

router = APIRouter()


@router.post(
    "/",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo người dùng mới",
)
def create_user(db: DbDep, user_in: UserCreate):
    service = UserService(db)
    # Kiểm tra xem username đã tồn tại chưa
    if service.get_user_by_username(user_in.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập '{user_in.username}' đã tồn tại trong hệ thống.",
        )
    return service.create_user(user_in)


@router.get(
    "/",
    response_model=UserList,
    summary="Lấy danh sách người dùng",
)
def get_users(
    db: DbDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    service = UserService(db)
    items, total = service.get_users(limit=limit, offset=offset)
    return UserList(total=total, offset=offset, limit=limit, items=items)


@router.get(
    "/{user_id}",
    response_model=UserOut,
    summary="Lấy chi tiết người dùng",
)
def get_user(db: DbDep, user_id: UUID):
    service = UserService(db)
    user = service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Người dùng không tồn tại.",
        )
    return user


@router.put(
    "/{user_id}",
    response_model=UserOut,
    summary="Cập nhật người dùng",
)
def update_user(db: DbDep, user_id: UUID, user_in: UserUpdate):
    service = UserService(db)
    user = service.update_user(user_id, user_in)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Người dùng không tồn tại để cập nhật.",
        )
    return user


@router.delete(
    "/{user_id}",
    summary="Xóa người dùng",
)
def delete_user(db: DbDep, user_id: UUID):
    service = UserService(db)
    deleted = service.delete_user(user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Người dùng không tồn tại để xóa.",
        )
    return {"message": "Người dùng đã được xóa thành công."}
