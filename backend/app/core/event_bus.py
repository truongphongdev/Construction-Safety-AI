import multiprocessing
import queue
import logging
from typing import Any

logger = logging.getLogger(__name__)

class EventBus:
    """
    Event Bus sử dụng multiprocessing.Queue.
    Cho phép Camera Workers (multiprocessing) đẩy sự kiện bất đồng bộ
    tới Event Consumer nhận tin nhắn để xử lý I/O (Database, Upload R2, WebSocket).
    """

    def __init__(self, maxsize: int = 1000):
        self._queue = multiprocessing.Queue(maxsize=maxsize)

    def publish(self, event: dict):
        """Đẩy sự kiện vào Queue (non-blocking để không bao giờ hoãn Camera Worker)."""
        try:
            self._queue.put_nowait(event)
        except queue.Full:
            logger.warning("Event Bus Queue bị đầy! Bỏ qua sự kiện mới nhất để đảm bảo real-time.")

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
