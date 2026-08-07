import time
from typing import Dict, List, Optional

class PPEChecker:
    """
    Kiểm tra vi phạm PPE (no_helmet, no_vest) theo từng Track ID.
    Duy trì cooldown 30 giây per track để tránh gửi cảnh báo trùng lặp liên tục.
    """

    def __init__(self, cooldown_seconds: float = 30.0):
        self.cooldown_seconds = cooldown_seconds
        # Mapping: (track_id, violation_type) -> timestamp của cảnh báo cuối
        self._last_alert_time: Dict[tuple, float] = {}

    def check(self, camera_id: str, tracks: List[dict]) -> List[dict]:
        """
        Duyệt danh sách các track (gồm bbox, track_id, labels/detections).
        Trả về danh sách các sự kiện vi phạm mới đạt điều kiện alert.
        """
        now = time.time()
        violations = []

        for trk in tracks:
            track_id = trk.get("track_id")
            label = trk.get("label")
            bbox = trk.get("bbox")
            confidence = trk.get("confidence", 0.0)

            if label in ["no_helmet", "no_vest"]:
                violation_type = label.upper()
                key = (f"{camera_id}_{track_id}", violation_type)
                last_time = self._last_alert_time.get(key, 0.0)

                if now - last_time >= self.cooldown_seconds:
                    self._last_alert_time[key] = now
                    violations.append({
                        "event_type": "PPE_VIOLATION",
                        "violation_type": violation_type,
                        "severity_level": "MEDIUM" if violation_type == "NO_VEST" else "CRITICAL",
                        "camera_id": camera_id,
                        "track_id": str(track_id),
                        "bbox": bbox,
                        "confidence": confidence,
                        "timestamp": now,
                    })

        return violations

    def cleanup_old_tracks(self, active_track_ids: List[str]):
        """Dọn dẹp cache cho các track_id đã biến mất khỏi màn hình lâu."""
        # Clean up stale track entries if needed
        pass
