import logging
import threading
import time
from typing import Dict

from workers.camera_worker import CameraWorkerProcess

logger = logging.getLogger(__name__)

class WorkerManager:
    """
    Quản lý danh sách các CameraWorkerProcess (spawn, kill, status).
    """

    def __init__(self):
        self._workers: Dict[str, CameraWorkerProcess] = {}
        self._lock = threading.Lock()

    def start_worker(self, camera_id: str, source: str, zones_provider=None) -> bool:
        """Khởi chạy 1 Camera Worker Process cho camera_id."""
        with self._lock:
            if camera_id in self._workers and self._workers[camera_id].is_alive():
                logger.info(f"Worker cho camera {camera_id} đã đang chạy.")
                return True

            worker = CameraWorkerProcess(camera_id, source, zones_provider=zones_provider)
            worker.daemon = True
            worker.start()
            self._workers[camera_id] = worker
            logger.info(f"Đã khởi chạy worker cho camera {camera_id}")
            return True

    def stop_worker(self, camera_id: str) -> bool:
        """Dừng worker của camera_id."""
        with self._lock:
            if camera_id in self._workers:
                worker = self._workers.pop(camera_id)
                worker.stop_event.set()
                worker.join(timeout=2.0)
                logger.info(f"Đã dừng worker cho camera {camera_id}")
                return True
            return False

    def stop_all(self):
        """Dừng tất cả các workers."""
        with self._lock:
            for camera_id, worker in list(self._workers.items()):
                worker.stop_event.set()
                worker.join(timeout=2.0)
            self._workers.clear()
            logger.info("Đã dừng tất cả Camera Workers.")

    def get_status(self) -> dict:
        """Trả về trạng thái hoạt động của các camera workers."""
        with self._lock:
            return {
                cam_id: worker.is_alive()
                for cam_id, worker in self._workers.items()
            }

# Singleton Manager
global_worker_manager = WorkerManager()
