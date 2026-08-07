import time
import logging
import threading
import multiprocessing
import cv2
import numpy as np
from typing import Dict, List, Optional

from app.ai.local_client import LocalPPEClient
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

    def __init__(self, source: str):
        self.source = source
        # Kiểm tra nếu source là số (USB cam)
        if str(source).isdigit():
            self.source = int(source)

        self.cap = cv2.VideoCapture(self.source)
        self._frame = None
        self._running = True
        self._lock = threading.Lock()
        self._thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._thread.start()

    def _reader_loop(self):
        while self._running:
            if not self.cap.isOpened():
                time.sleep(0.5)
                self.cap = cv2.VideoCapture(self.source)
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


class CameraWorkerProcess(multiprocessing.Process):
    """
    Process riêng cho 1 camera.
    Vòng lặp: Ingest frame mới nhất -> Triton Detection -> BoT-SORT Tracking -> PPE/Zone Check -> EventBus -> MJPEG Overlay.
    """

    def __init__(self, camera_id: str, source: str, zones_provider=None):
        super().__init__()
        self.camera_id = camera_id
        self.source = source
        self.zones_provider = zones_provider
        self.stop_event = multiprocessing.Event()

    def run(self):
        logger.info(f"Bắt đầu Camera Worker Process cho camera: {self.camera_id} (Source: {self.source})")
        reader = LatestFrameReader(self.source)
        local_client = LocalPPEClient()
        ppe_checker = PPEChecker(cooldown_seconds=30.0)
        zone_checker = ZoneChecker(debounce_frames=5, cooldown_seconds=30.0)

        # Simple ID Tracker fallback
        track_counter = 0

        try:
            while not self.stop_event.is_set():
                frame = reader.read()
                if frame is None:
                    time.sleep(0.01)
                    continue

                # 1. Detection local
                detections = local_client.detect(frame)

                # 2. Tracking simulation / BoT-SORT mapping
                tracks = []
                for det in detections:
                    track_counter += 1
                    tracks.append({
                        "track_id": f"cam{self.camera_id[:4]}-{track_counter % 1000}",
                        "bbox": det["bbox"],
                        "label": det["label"],
                        "confidence": det["confidence"],
                    })

                # 3. Phân tích PPE & Zone
                ppe_events = ppe_checker.check(self.camera_id, tracks)

                zones = []
                if self.zones_provider:
                    try:
                        zones = self.zones_provider(self.camera_id)
                    except Exception:
                        pass
                zone_events = zone_checker.check(self.camera_id, tracks, zones)

                # 4. Phát sự kiện tới EventBus
                for evt in ppe_events + zone_events:
                    evt["frame_jpg"] = frame.copy()
                    global_event_bus.publish(evt)

                # 5. Vẽ overlay Bbox & Labels
                annotated_frame = frame.copy()
                for trk in tracks:
                    x1, y1, x2, y2 = [int(v) for v in trk["bbox"]]
                    lbl = trk["label"]
                    conf = trk["confidence"]
                    t_id = trk["track_id"]

                    color = (0, 255, 0) if lbl in ["helmet", "vest"] else (0, 0, 255)
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

                # 6. Encode JPEG & Cập nhật Ring Buffer MJPEG
                ret, jpeg_buf = cv2.imencode(".jpg", annotated_frame)
                if ret:
                    set_latest_mjpeg_frame(self.camera_id, jpeg_buf.tobytes())

                time.sleep(0.03)  # ~30 FPS loop control

        except Exception as e:
            logger.error(f"Lỗi trong Camera Worker Process {self.camera_id}: {e}", exc_info=True)
        finally:
            reader.stop()
            logger.info(f"Đã dừng Camera Worker Process cho camera: {self.camera_id}")
