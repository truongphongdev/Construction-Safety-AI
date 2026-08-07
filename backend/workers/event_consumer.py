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
    Rút event từ EventBus Queue -> Ghi DB PostgreSQL -> Upload MinIO -> WebSocket Broadcast.
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
        while self._running:
            event = global_event_bus.consume(block=True, timeout=1.0)
            if event is None:
                continue

            try:
                self._process_event(event)
            except Exception as e:
                logger.error(f"Lỗi khi xử lý sự kiện trong EventConsumer: {e}", exc_info=True)

    def _process_event(self, event: dict):
        event_type = event.get("event_type")
        camera_id_str = event.get("camera_id")
        violation_type = event.get("violation_type", "UNKNOWN")
        severity_level = event.get("severity_level", "MEDIUM")
        track_id = event.get("track_id")
        frame_jpg = event.get("frame_jpg")  # Bytes hoặc numpy
        bbox = event.get("bbox")
        confidence = event.get("confidence", 0.0)

        # 1. Encode frame if numpy
        image_bytes = None
        if isinstance(frame_jpg, np.ndarray):
            ret, buf = cv2.imencode(".jpg", frame_jpg)
            if ret:
                image_bytes = buf.tobytes()
        elif isinstance(frame_jpg, bytes):
            image_bytes = frame_jpg

        # 2. Upload MinIO
        evidence_key = f"evidence_{camera_id_str}_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}.jpg"
        stored_key = None
        if image_bytes:
            stored_key = minio_storage.save_and_upload(evidence_key, image_bytes)

        if not stored_key:
            logger.warning("Không thể lưu ảnh vi phạm (MinIO không khả dụng)")

        # 3. Insert into PostgreSQL DB
        db = SessionLocal()
        violation_record = None
        try:
            cam_uuid = uuid.UUID(camera_id_str) if isinstance(camera_id_str, str) else camera_id_str
            violation_record = ViolationModel(
                id=uuid.uuid4(),
                camera_id=cam_uuid,
                detected_time=datetime.now(timezone.utc),
                violation_type=violation_type,
                severity_level=severity_level,
                track_id=str(track_id) if track_id else None,
                evidence_key=stored_key or evidence_key,
                image_path=stored_key or evidence_key, # Store key as image_path to generate presigned URL later
                video_bucket="default",
                video_path="none",
                status="PENDING",
                ai_metadata={
                    "event_type": event_type,
                    "confidence": confidence,
                    "bbox": bbox,
                    "zone_name": event.get("zone_name"),
                }
            )
            db.add(violation_record)
            db.commit()
            db.refresh(violation_record)
            logger.info(f"Đã lưu vi phạm vào DB: {violation_type} | Camera: {camera_id_str} | Track: {track_id}")
        except Exception as db_err:
            db.rollback()
            logger.error(f"Lỗi ghi DB vi phạm: {db_err}")
        finally:
            db.close()

        # 4. Broadcast WebSocket Alert
        alert_payload = {
            "id": str(violation_record.id) if violation_record else str(uuid.uuid4()),
            "camera_id": str(camera_id_str),
            "violation_type": violation_type,
            "severity_level": severity_level,
            "track_id": track_id,
            "detected_time": datetime.now(timezone.utc).isoformat(),
            "evidence_url": minio_storage.get_presigned_url(stored_key or evidence_key),
            "bbox": bbox,
        }

        for cb in _ws_broadcast_callbacks:
            try:
                cb(alert_payload)
            except Exception as ws_err:
                logger.error(f"Lỗi broadcast WebSocket callback: {ws_err}")

# Singleton Event Consumer
global_event_consumer = EventConsumerThread()
