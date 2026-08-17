import time
from typing import Dict, List, Optional

class PPEChecker:
    """
    Kiểm tra vi phạm PPE (no_helmet, no_vest).
    Duy trì cooldown 5 giây per camera/violation để tránh gửi cảnh báo trùng lặp liên tục.
    """

    def __init__(self, cooldown_seconds: float = 5.0):
        self.cooldown_seconds = cooldown_seconds
        # Mapping: (camera_id, violation_type) -> timestamp của cảnh báo cuối
        self._last_alert_time: Dict[tuple, float] = {}

    def check(self, camera_id: str, tracks: List[dict]) -> List[dict]:
        """
        Duyệt danh sách các track (gồm bbox, track_id, labels/detections).
        Trả về danh sách các sự kiện vi phạm mới đạt điều kiện alert (tối thiểu 5s / lần).
        """
        now = time.time()
        violations = []

        for trk in tracks:
            track_id = trk.get("track_id")
            raw_label = str(trk.get("label", ""))
            bbox = trk.get("bbox")
            confidence = trk.get("confidence", 0.0)

            clean_label = raw_label.lower().strip().replace("-", "_").replace(" ", "_")

            violation_type = None
            severity_level = "MEDIUM"

            if clean_label in ["no_helmet", "no_hardhat", "no_hard_hat", "without_helmet"]:
                violation_type = "NO_HELMET"
                severity_level = "CRITICAL"
            elif clean_label in ["no_vest", "no_safety_vest", "without_vest"]:
                violation_type = "NO_VEST"
                severity_level = "MEDIUM"
            elif clean_label in ["fall", "falling", "person_fallen"]:
                violation_type = "FALL"
                severity_level = "CRITICAL"
            elif clean_label in ["zone_intrusion", "intrusion"]:
                violation_type = "ZONE_INTRUSION"
                severity_level = "CRITICAL"

            if violation_type:
                key = (str(camera_id), violation_type)
                last_time = self._last_alert_time.get(key, 0.0)

                if now - last_time >= self.cooldown_seconds:
                    self._last_alert_time[key] = now
                    violations.append({
                        "event_type": "PPE_VIOLATION",
                        "violation_type": violation_type,
                        "severity_level": severity_level,
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
