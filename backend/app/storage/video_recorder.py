import os
import time
import uuid
import logging
from pathlib import Path
from typing import List, Optional
import cv2
import numpy as np

from app.config import BASE_DIR

logger = logging.getLogger(__name__)

# Thư mục lưu trữ video tĩnh
VIOLATIONS_DIR = BASE_DIR / "static" / "violations"
VIOLATIONS_DIR.mkdir(parents=True, exist_ok=True)


def save_violation_video(
    frames: List[np.ndarray],
    camera_id: str,
    violation_type: str = "VIOLATION",
    fps: float = 10.0
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Ghi một danh sách các frame (numpy BGR) thành file video .mp4 và ảnh thumbnail .jpg.
    Trả về: (rel_video_path, rel_thumb_path, full_video_path, full_thumb_path)
    """
    if not frames or len(frames) == 0:
        logger.warning("Không có frame để ghi video vi phạm.")
        return None, None, None, None

    try:
        VIOLATIONS_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = int(time.time() * 1000)
        random_suffix = uuid.uuid4().hex[:6]
        safe_vtype = "".join(c for c in violation_type if c.isalnum() or c in ("_", "-")).lower()
        safe_cam = "".join(c for c in camera_id if c.isalnum() or c in ("_", "-"))[:8]
        
        base_filename = f"vio_{safe_cam}_{safe_vtype}_{timestamp}_{random_suffix}"
        video_filename = f"{base_filename}.mp4"
        thumb_filename = f"{base_filename}.jpg"

        video_full_path = VIOLATIONS_DIR / video_filename
        thumb_full_path = VIOLATIONS_DIR / thumb_filename

        # Lấy kích thước frame
        first_frame = frames[0]
        height, width = first_frame.shape[:2]

        # 1. Lưu thumbnail từ frame giữa hoặc frame cuối
        mid_idx = len(frames) // 2
        thumb_frame = frames[mid_idx]
        cv2.imwrite(str(thumb_full_path), thumb_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])

        # 2. Ghi video MP4 tương thích tốt với trình duyệt Web (H264 / avc1 / mp4v)
        out = None
        # Thử Media Foundation H264 trước (chuẩn H264 phát trực tiếp mượt trên trình duyệt)
        try:
            out = cv2.VideoWriter(str(video_full_path), cv2.CAP_MSMF, cv2.VideoWriter_fourcc(*'H264'), fps, (width, height))
        except Exception:
            out = None

        if out is None or not out.isOpened():
            fourcc = cv2.VideoWriter_fourcc(*'avc1')
            out = cv2.VideoWriter(str(video_full_path), fourcc, fps, (width, height))

        if not out.isOpened():
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(str(video_full_path), fourcc, fps, (width, height))

        for f in frames:
            if f.shape[:2] != (height, width):
                f = cv2.resize(f, (width, height))
            out.write(f)

        out.release()
        logger.info(f"Đã ghi video vi phạm thành công: {video_filename} ({len(frames)} frames, {fps} fps)")

        rel_video_path = f"/static/violations/{video_filename}"
        rel_thumb_path = f"/static/violations/{thumb_filename}"
        return rel_video_path, rel_thumb_path, str(video_full_path), str(thumb_full_path)

    except Exception as e:
        logger.error(f"Lỗi khi ghi video vi phạm: {e}", exc_info=True)
        return None, None, None, None
