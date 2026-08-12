import queue
import time
import logging
from typing import Any

logger = logging.getLogger(__name__)

class EventBus:
    """
    Event Bus sử dụng queue.Queue (Thread-safe).
    Cho phép Camera Workers đẩy sự kiện bất đồng bộ
    tới Event Consumer nhận tin nhắn để xử lý I/O (Database, Upload MinIO, WebSocket).
    """

    def __init__(self, maxsize: int = 2000):
        self._queue = queue.Queue(maxsize=maxsize)
        self._last_warning_time = 0.0

    def publish(self, event: dict):
        """Đẩy sự kiện vào Queue (non-blocking, tự bỏ sự kiện cũ nhất nếu đầy)."""
        try:
            self._queue.put_nowait(event)
        except queue.Full:
            # Nếu queue đầy, lấy sự kiện cũ nhất bỏ đi rồi chèn mới (drop oldest)
            try:
                self._queue.get_nowait()
            except queue.Empty:
                pass
            try:
                self._queue.put_nowait(event)
            except queue.Full:
                pass

            now = time.time()
            if now - self._last_warning_time > 30.0:
                logger.warning("Event Bus Queue bị đầy! Đã tự động loại bỏ sự kiện cũ nhất để giữ trôi chảy (log ẩn 30s).")
                self._last_warning_time = now

    def consume(self, block: bool = True, timeout: float = 1.0) -> Any:
        """Lấy sự kiện ra khỏi Queue."""
        try:
            return self._queue.get(block=block, timeout=timeout)
        except queue.Empty:
            return None

    def size(self) -> int:
        return self._queue.qsize()

# Global Event Bus Singleton
global_event_bus = EventBus()

