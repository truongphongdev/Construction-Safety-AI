import os
import time
import uuid
import logging
import threading
import cv2
import numpy as np
from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.core.event_bus import global_event_bus
from app.models.violation import ViolationModel
from app.storage.video_recorder import save_violation_video
from app.storage.minio_client import minio_storage

logger = logging.getLogger(__name__)

# Callback registry cho WebSocket broadcasting
_ws_broadcast_callbacks = []

def register_ws_callback(callback):
    """Đăng ký callback broadcast WebSocket từ FastAPI event loop."""
    if callback not in _ws_broadcast_callbacks:
        _ws_broadcast_callbacks.append(callback)

class EventConsumerThread:
    """
    Consumer duy nhất chạy trong thread/process riêng.
    Rút event từ EventBus Queue -> Ghi video vi phạm (MP4) -> Upload MinIO -> Ghi DB PostgreSQL -> WebSocket Broadcast.
    """

    def __init__(self):
        self._running = False
        self._thread = None

    def start(self):
        if not self._running:
            self._running = True
            self._thread = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
            logger.info("Event Consumer Thread đã khởi động.")

    def stop(self):
        self._running = False

    def _loop(self):
        logger.info(f"EventConsumer loop started. MinIO s3_client={minio_storage.s3_client is not None}, bucket={minio_storage.bucket_name}")
        while self._running:
            event = global_event_bus.consume(block=True, timeout=1.0)
            if event is None:
                continue

            try:
                logger.info(f"[EventConsumer] Nhận event: type={event.get('event_type')}, violation={event.get('violation_type')}, cam={event.get('camera_id')}, has_frames={event.get('video_frames') is not None}, has_jpg={event.get('frame_jpg') is not None}")
                self._process_event(event)
            except Exception as e:
                logger.error(f"Lỗi khi xử lý sự kiện trong EventConsumer: {e}", exc_info=True)

    def _process_event(self, event: dict):
        event_type = event.get("event_type")
        camera_id_str = str(event.get("camera_id", "cam1"))
        violation_type = event.get("violation_type", "UNKNOWN")
        severity_level = event.get("severity_level", "MEDIUM")
        track_id = event.get("track_id")
        video_frames = event.get("video_frames")  # List of numpy frames
        frame_jpg = event.get("frame_jpg")  # Single frame or bytes
        bbox = event.get("bbox")
        confidence = event.get("confidence", 0.0)

        # 1. Ghi video MP4 vi phạm cục bộ
        rel_video_path = None
        rel_thumb_path = None
        full_video_path = None
        full_thumb_path = None

        if video_frames and isinstance(video_frames, list) and len(video_frames) > 0:
            fps = float(event.get("fps", 10.0))
            rel_video_path, rel_thumb_path, full_video_path, full_thumb_path = save_violation_video(
                frames=video_frames,
                camera_id=camera_id_str,
                violation_type=violation_type,
                fps=fps
            )
        elif frame_jpg is not None:
            single_frame = None
            if isinstance(frame_jpg, np.ndarray):
                single_frame = frame_jpg
            elif isinstance(frame_jpg, bytes):
                nparr = np.frombuffer(frame_jpg, np.uint8)
                single_frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if single_frame is not None:
                pseudo_frames = [single_frame.copy() for _ in range(60)]
                rel_video_path, rel_thumb_path, full_video_path, full_thumb_path = save_violation_video(
                    frames=pseudo_frames,
                    camera_id=camera_id_str,
                    violation_type=violation_type,
                    fps=10.0
                )

        # 2. Upload Video & Thumbnail lên MinIO
        minio_video_key = None
        minio_thumb_key = None
        logger.info(f"[EventConsumer] Video ghi xong: full_video={full_video_path}, full_thumb={full_thumb_path}, minio_client={minio_storage.s3_client is not None}")

        if full_video_path and os.path.exists(full_video_path):
            video_filename = os.path.basename(full_video_path)
            logger.info(f"[EventConsumer] Đang upload video lên MinIO: {video_filename}")
            minio_video_key = minio_storage.upload_file(full_video_path, video_filename, "video/mp4")
            logger.info(f"[EventConsumer] Upload video result: {repr(minio_video_key)}")
            # Xóa file local sau khi upload lên MinIO thành công (chỉ lưu trên MinIO)
            if minio_video_key:
                try:
                    os.remove(full_video_path)
                except Exception:
                    pass

        if full_thumb_path and os.path.exists(full_thumb_path):
            thumb_filename = os.path.basename(full_thumb_path)
            minio_thumb_key = minio_storage.upload_file(full_thumb_path, thumb_filename, "image/jpeg")
            # Xóa ảnh thumbnail local sau khi upload lên MinIO thành công
            if minio_thumb_key:
                try:
                    os.remove(full_thumb_path)
                except Exception:
                    pass

        # Lưu key nếu upload MinIO thành công, fallback về static relative path
        stored_video = minio_video_key if minio_video_key else rel_video_path
        stored_image = minio_thumb_key if minio_thumb_key else rel_thumb_path
        bucket_name = minio_storage.bucket_name if minio_video_key else "local_static"

        # 3. Insert into PostgreSQL DB
        db = SessionLocal()
        violation_record = None
        try:
            from app.models.camera import CameraModel
            try:
                cam_uuid = uuid.UUID(camera_id_str) if isinstance(camera_id_str, str) and len(camera_id_str) == 36 else uuid.UUID("00000000-0000-0000-0000-000000000001")
            except Exception:
                cam_uuid = uuid.UUID("00000000-0000-0000-0000-000000000001")

            # Đảm bảo camera_id tồn tại trong bảng cameras (tránh lỗi Foreign Key)
            existing_cam = db.query(CameraModel).filter(CameraModel.id == cam_uuid).first()
            if not existing_cam:
                default_cam = db.query(CameraModel).filter(CameraModel.id == uuid.UUID("00000000-0000-0000-0000-000000000001")).first()
                if default_cam:
                    cam_uuid = default_cam.id
                else:
                    new_cam = CameraModel(
                        id=cam_uuid,
                        name=f"Camera {camera_id_str[:8]}",
                        location_desc="Công trường",
                        ip_address="127.0.0.1",
                        status="ACTIVE"
                    )
                    db.add(new_cam)
                    db.commit()

            violation_record = ViolationModel(
                id=uuid.uuid4(),
                camera_id=cam_uuid,
                detected_time=datetime.now(timezone.utc),
                violation_type=violation_type,
                severity_level=severity_level,
                track_id=str(track_id) if track_id else None,
                evidence_key=stored_video or "none",
                image_path=stored_image,
                video_bucket=bucket_name,
                video_path=stored_video,
                status="PENDING",
                ai_metadata={
                    "event_type": event_type,
                    "confidence": confidence,
                    "bbox": bbox,
                    "zone_name": event.get("zone_name"),
                    "fps": event.get("fps", 10.0),
                    "minio_uploaded": bool(minio_video_key),
                }
            )
            db.add(violation_record)
            db.commit()
            db.refresh(violation_record)
            logger.info(f"Đã lưu vi phạm vào DB: {violation_type} | Video: {stored_video} | MinIO: {bool(minio_video_key)}")
        except Exception as db_err:
            db.rollback()
            logger.error(f"Lỗi ghi DB vi phạm: {db_err}", exc_info=True)
        finally:
            db.close()

        # 4. Broadcast WebSocket Alert
        video_url = minio_storage.get_presigned_url(stored_video) if (stored_video and not stored_video.startswith("/")) else stored_video
        image_url = minio_storage.get_presigned_url(stored_image) if (stored_image and not stored_image.startswith("/")) else stored_image

        alert_payload = {
            "id": str(violation_record.id) if violation_record else str(uuid.uuid4()),
            "camera_id": str(camera_id_str),
            "violation_type": violation_type,
            "severity_level": severity_level,
            "track_id": track_id,
            "detected_time": datetime.now(timezone.utc).isoformat(),
            "evidence_url": video_url or image_url,
            "video_url": video_url,
            "image_url": image_url,
            "bbox": bbox,
        }

        for cb in _ws_broadcast_callbacks:
            try:
                cb(alert_payload)
            except Exception as ws_err:
                logger.error(f"Lỗi broadcast WebSocket callback: {ws_err}")

# Singleton Event Consumer
global_event_consumer = EventConsumerThread()
