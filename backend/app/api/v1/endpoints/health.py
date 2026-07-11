from fastapi import APIRouter

router = APIRouter()


@router.get("/", summary="Root health check")
def root():
    """Kiểm tra server đang chạy."""
    return {"status": "ok", "message": "Construction Safety AI API is running 🚀"}


@router.get("/health", summary="Health check cho load balancer / CI")
def health_check():
    """Trả về HTTP 200 khi service healthy."""
    return {"status": "healthy"}
