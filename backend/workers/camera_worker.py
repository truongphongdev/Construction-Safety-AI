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
        ppe_checker = PPEChecker(cooldown_seconds=30.0)
        zone_checker = ZoneChecker(debounce_frames=5, cooldown_seconds=30.0)

        track_counter = 0
        last_inference_time = 0.0
        inference_interval = 0.25  # Chạy AI mỗi 0.25s (4 FPS AI) — GPU RTX 2050 xử lý cực nhanh
        latest_tracks: List[dict] = []

        try:
            while not self.stop_event.is_set():
                frame = reader.read()
                if frame is None:
                    time.sleep(0.01)
                    continue

                now = time.time()

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

                        # Phân tích vi phạm
                        ppe_events = ppe_checker.check(self.camera_id, latest_tracks)

                        zones = []
                        if self.zones_provider:
                            try:
                                zones = self.zones_provider(self.camera_id)
                            except Exception:
                                pass
                        zone_events = zone_checker.check(self.camera_id, latest_tracks, zones)

                        # Phát sự kiện tới EventBus
                        for evt in ppe_events + zone_events:
                            evt["frame_jpg"] = frame.copy()
                            global_event_bus.publish(evt)
                    except Exception as ai_err:
                        logger.error(f"Lỗi AI inference trong Camera Worker {self.camera_id}: {ai_err}")

                # 2. Vẽ overlay Bbox & Labels lên frame hiện tại sử dụng kết quả detection mới nhất
                annotated_frame = frame.copy()
                for trk in latest_tracks:
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

