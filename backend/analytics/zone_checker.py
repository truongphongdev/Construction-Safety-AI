import time
import cv2
import numpy as np
from typing import Dict, List, Tuple

class ZoneChecker:
    """
    Kiểm tra người đi vào vùng cấm (Zone Intrusion Detection).
    Tọa độ kiểm tra: điểm chân (center-bottom của bbox).
    Áp dụng debounce (liên tiếp N frame) và cooldown per track.
    """

    def __init__(self, debounce_frames: int = 3, cooldown_seconds: float = 5.0):
        self.debounce_frames = debounce_frames
        self.cooldown_seconds = cooldown_seconds
        # Mapping: (track_id, zone_id) -> số frame liên tiếp nằm trong zone
        self._inside_counts: Dict[Tuple[str, str], int] = {}
        # Mapping: (track_id, zone_id) -> timestamp của cảnh báo cuối
        self._last_alert_time: Dict[Tuple[str, str], float] = {}

    def check(self, camera_id: str, tracks: List[dict], zones: List[dict]) -> List[dict]:
        """
        Args:
            camera_id: ID của camera.
            tracks: List các track [{track_id, bbox, label...}].
            zones: List các zone [{id, name, polygon_coords, severity...}].
        """
        now = time.time()
        violations = []

        if not zones or not tracks:
            return violations

        for trk in tracks:
            # Kiểm tra cho đối tượng là người (person hoặc bất kỳ track nào có bbox)
            track_id = str(trk.get("track_id"))
            bbox = trk.get("bbox")
            if not bbox or len(bbox) < 4:
                continue

            x1, y1, x2, y2 = bbox
            foot_point = (float((x1 + x2) / 2.0), float(y2))

            for zone in zones:
                zone_id = str(zone.get("id"))
                polygon_coords = zone.get("polygon_coords", [])
                severity = zone.get("severity", "CRITICAL")
                zone_name = zone.get("name", "Restricted Zone")

                if len(polygon_coords) < 3:
                    continue

                poly_np = np.array(polygon_coords, dtype=np.int32).reshape((-1, 1, 2))
                # cv2.pointPolygonTest trả về >= 0 nếu nằm bên trong hoặc trên viền
                is_inside = cv2.pointPolygonTest(poly_np, foot_point, False) >= 0

                key = (track_id, zone_id)

                if is_inside:
                    self._inside_counts[key] = self._inside_counts.get(key, 0) + 1
                    count = self._inside_counts[key]
                    last_time = self._last_alert_time.get(key, 0.0)

                    if count >= self.debounce_frames and (now - last_time >= self.cooldown_seconds):
                        self._last_alert_time[key] = now
                        violations.append({
                            "event_type": "ZONE_INTRUSION",
                            "violation_type": "ZONE_INTRUSION",
                            "severity_level": severity,
                            "camera_id": camera_id,
                            "track_id": track_id,
                            "zone_name": zone_name,
                            "bbox": bbox,
                            "confidence": trk.get("confidence", 1.0),
                            "timestamp": now,
                        })
                else:
                    self._inside_counts[key] = 0

        return violations
