import time
import logging
import threading
import cv2
import numpy as np
from typing import Dict, List, Optional

from app.ai.local_client import get_local_ppe_client
from analytics.ppe_checker import PPEChecker
from analytics.zone_checker import ZoneChecker
from app.core.event_bus import global_event_bus

logger = logging.getLogger(__name__)

# Dictionary lưu trữ khung hình MJPEG mới nhất theo camera_id cho Server-side streaming
# Được cập nhật trong từng Camera Worker
_latest_mjpeg_frames: Dict[str, bytes] = {}
_frame_locks: Dict[str, threading.Lock] = {}

def get_latest_mjpeg_frame(camera_id: str) -> Optional[bytes]:
    """Trả về frame JPEG mới nhất cho endpoint GET /stream/{camera_id}."""
    lock = _frame_locks.setdefault(camera_id, threading.Lock())
    with lock:
        return _latest_mjpeg_frames.get(camera_id)

def set_latest_mjpeg_frame(camera_id: str, frame_bytes: bytes):
    """Cập nhật frame JPEG mới nhất."""
    lock = _frame_locks.setdefault(camera_id, threading.Lock())
    with lock:
        _latest_mjpeg_frames[camera_id] = frame_bytes


class LatestFrameReader:
    """Đọc video stream/file liên tục và chỉ giữ frame mới nhất (loại bỏ lag buffer)."""

    def _create_capture(self):
        if isinstance(self.source, int):
            return cv2.VideoCapture(self.source, cv2.CAP_DSHOW)
        return cv2.VideoCapture(self.source)

    def __init__(self, source: str):
        self.source = source
        # Kiểm tra nếu source là số (USB cam)
        if str(source).isdigit():
            self.source = int(source)

        self.cap = self._create_capture()
        self._frame = None
        self._running = True
        self._lock = threading.Lock()
        self._thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._thread.start()

    def _reader_loop(self):
        while self._running:
            if not self.cap.isOpened():
                time.sleep(0.5)
                self.cap = self._create_capture()
                continue

            ret, frame = self.cap.read()
            if not ret:
                # Nếu là file video -> rewind phát lại
                if isinstance(self.source, str) and not self.source.startswith("rtsp"):
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                time.sleep(0.01)
                continue

            with self._lock:
                self._frame = frame

    def read(self) -> Optional[np.ndarray]:
        with self._lock:
            return self._frame.copy() if self._frame is not None else None

    def stop(self):
        self._running = False
        if self.cap:
            self.cap.release()


class CameraWorkerThread(threading.Thread):
    """
    Thread riêng cho 1 camera.
    Vòng lặp: Đọc frame mới nhất (~30 FPS) -> Hiển thị MJPEG mượt.
    Chạy AI Inference định kỳ (mỗi ~0.5 - 1.0 giây) để giảm tải CPU 90%.
    """

    def __init__(self, camera_id: str, source: str, zones_provider=None):
        super().__init__(daemon=True)
        self.camera_id = camera_id
        self.source = source
        self.zones_provider = zones_provider
        self.stop_event = threading.Event()

    def stop(self):
        self.stop_event.set()

    def run(self):
        logger.info(f"Bắt đầu Camera Worker Thread cho camera: {self.camera_id} (Source: {self.source})")
        reader = LatestFrameReader(self.source)
        local_client = get_local_ppe_client()
        ppe_checker = PPEChecker(cooldown_seconds=5.0)
        zone_checker = ZoneChecker(debounce_frames=3, cooldown_seconds=5.0)

        from collections import deque
        frame_buffer = deque(maxlen=72)  # Lưu trữ 6 giây khung hình (72 frames @ 12 FPS) để trích xuất clip video vi phạm

        track_counter = 0
        last_inference_time = 0.0
        last_config_check_time = 0.0
        inference_interval = 0.25  # Chạy AI mỗi 0.25s (4 FPS AI) — GPU RTX 2050 xử lý cực nhanh
        latest_tracks: List[dict] = []
        latest_zones: List[dict] = []
        cam_config = {"ppe_enabled": True, "zone_enabled": True}

        try:
            while not self.stop_event.is_set():
                frame = reader.read()
                if frame is None:
                    time.sleep(0.01)
                    continue

                now = time.time()
                h, w = frame.shape[:2]

                # Định kỳ cập nhật config camera & zones (mỗi 15s)
                if now - last_config_check_time >= 15.0:
                    last_config_check_time = now
                    try:
                        from app.core.database import SessionLocal
                        from app.models.camera import CameraModel
                        from app.models.zone import ZoneModel
                        import uuid
                        db = SessionLocal()
                        try:
                            cam_uuid = uuid.UUID(self.camera_id) if len(self.camera_id) == 36 else None
                            if cam_uuid:
                                cam = db.query(CameraModel).filter(CameraModel.id == cam_uuid).first()
                                if cam:
                                    cam_config["ppe_enabled"] = getattr(cam, "ppe_enabled", True)
                                    cam_config["zone_enabled"] = getattr(cam, "zone_enabled", True)

                                zones_db = db.query(ZoneModel).filter(ZoneModel.camera_id == cam_uuid, ZoneModel.is_active == True).all()
                                latest_zones = [
                                    {
                                        "id": str(z.id),
                                        "name": z.name,
                                        "polygon_coords": z.polygon_coords,
                                        "severity": z.severity,
                                        "color": getattr(z, "color", "#ef4444")
                                    } for z in zones_db
                                ]
                        finally:
                            db.close()
                    except Exception:
                        pass

                # 1. Định kỳ chạy AI Inference nếu đủ thời gian giãn cách
                if now - last_inference_time >= inference_interval:
                    last_inference_time = now
                    try:
                        detections = local_client.detect(frame)
                        tracks = []
                        for det in detections:
                            track_counter += 1
                            tracks.append({
                                "track_id": f"cam{self.camera_id[:4]}-{track_counter % 1000}",
                                "bbox": det["bbox"],
                                "label": det["label"],
                                "confidence": det["confidence"],
                            })
                        latest_tracks = tracks

                        # Phân tích vi phạm PPE (nếu bật)
                        ppe_events = []
                        if cam_config.get("ppe_enabled", True):
                            ppe_events = ppe_checker.check(self.camera_id, latest_tracks)

                        # Phân tích vi phạm vùng cấm (nếu bật)
                        zone_events = []
                        if cam_config.get("zone_enabled", True):
                            zones = latest_zones
                            if self.zones_provider:
                                try:
                                    zones = self.zones_provider(self.camera_id)
                                except Exception:
                                    pass
                            zone_events = zone_checker.check(self.camera_id, latest_tracks, zones, frame_width=w, frame_height=h)

                        # Phát sự kiện tới EventBus kèm video frames buffer
                        all_events = ppe_events + zone_events
                        if all_events:
                            buffered_video = list(frame_buffer) if len(frame_buffer) > 0 else [frame.copy()]
                            for evt in all_events:
                                evt["frame_jpg"] = frame.copy()
                                evt["video_frames"] = buffered_video
                                evt["fps"] = 12.0
                                global_event_bus.publish(evt)
                    except Exception as ai_err:
                        logger.error(f"Lỗi AI inference trong Camera Worker {self.camera_id}: {ai_err}")

                # 2. Vẽ overlay Bbox & Zone Polygons lên frame
                annotated_frame = frame.copy()

                # Vẽ vùng cấm (nếu có zones)
                if cam_config.get("zone_enabled", True) and latest_zones:
                    overlay = annotated_frame.copy()
                    for z in latest_zones:
                        coords = z.get("polygon_coords", [])
                        if len(coords) < 3:
                            continue
                        is_norm = all(0.0 <= pt[0] <= 1.0 and 0.0 <= pt[1] <= 1.0 for pt in coords)
                        if is_norm:
                            poly_pts = np.array([[int(pt[0] * w), int(pt[1] * h)] for pt in coords], np.int32)
                        else:
                            poly_pts = np.array([[int(pt[0]), int(pt[1])] for pt in coords], np.int32)
                        poly_pts = poly_pts.reshape((-1, 1, 2))

                        cv2.fillPoly(overlay, [poly_pts], (0, 0, 220))
                        cv2.polylines(annotated_frame, [poly_pts], True, (0, 0, 255), 2)
                        if len(poly_pts) > 0:
                            top_pt = poly_pts[0][0]
                            cv2.putText(annotated_frame, f"ZONE: {z.get('name', 'Vung cam')}", (top_pt[0], max(top_pt[1] - 5, 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 255), 2)

                    cv2.addWeighted(overlay, 0.25, annotated_frame, 0.75, 0, annotated_frame)

                # Vẽ bounding boxes
                for trk in latest_tracks:
                    x1, y1, x2, y2 = [int(v) for v in trk["bbox"]]
                    lbl = trk["label"]
                    conf = trk["confidence"]
                    t_id = trk["track_id"]

                    lbl_clean = str(lbl).lower().replace("-", "_").replace(" ", "_")
                    color = (0, 255, 0) if lbl_clean in ["helmet", "vest"] else (0, 0, 255)
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(
                        annotated_frame,
                        f"[{t_id}] {lbl} {conf:.2f}",
                        (x1, max(y1 - 10, 20)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        color,
                        2
                    )

                # Lưu frame có annotation vào rolling buffer để xuất clip vi phạm
                frame_buffer.append(annotated_frame.copy())

                # 3. Encode JPEG & Cập nhật Buffer MJPEG (đảm bảo luồng xem video mượt và nét)
                ret, jpeg_buf = cv2.imencode(".jpg", annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                if ret:
                    set_latest_mjpeg_frame(self.camera_id, jpeg_buf.tobytes())

                time.sleep(0.04)  # ~25 FPS stream loop control

        except Exception as e:
            logger.error(f"Lỗi trong Camera Worker Thread {self.camera_id}: {e}", exc_info=True)
        finally:
            reader.stop()
            logger.info(f"Đã dừng Camera Worker Thread cho camera: {self.camera_id}")

# Alias giữ tương thích
CameraWorkerProcess = CameraWorkerThread

