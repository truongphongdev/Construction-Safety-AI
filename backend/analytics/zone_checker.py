import time
import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional

class ZoneChecker:
    """
    Kiểm tra người đi vào vùng cấm (Zone Intrusion Detection).
    Tọa độ kiểm tra: điểm chân (center-bottom của bbox).
    Hỗ trợ cả tọa độ chuẩn hóa (0.0 - 1.0) và tọa độ pixel.
    Áp dụng AABB pre-filtering, debounce (liên tiếp N frame) và cooldown per track.
    """

    def __init__(self, debounce_frames: int = 3, cooldown_seconds: float = 5.0):
        self.debounce_frames = debounce_frames
        self.cooldown_seconds = cooldown_seconds
        # Mapping: (track_id, zone_id) -> số frame liên tiếp nằm trong zone
        self._inside_counts: Dict[Tuple[str, str], int] = {}
        # Mapping: (track_id, zone_id) -> timestamp của cảnh báo cuối
        self._last_alert_time: Dict[Tuple[str, str], float] = {}
        # Mapping: track_id -> timestamp cuối nhìn thấy để cleanup
        self._last_seen_track: Dict[str, float] = {}
        self._last_cleanup_time = time.time()

    def _cleanup_stale_tracks(self, now: float, max_age: float = 60.0):
        """Xóa bớt bộ nhớ đệm của các track đã biến mất quá max_age giây."""
        if now - self._last_cleanup_time < 30.0:
            return
        self._last_cleanup_time = now

        stale_tracks = {
            t_id for t_id, seen_time in self._last_seen_track.items()
            if (now - seen_time) > max_age
        }
        if not stale_tracks:
            return

        self._inside_counts = {
            k: v for k, v in self._inside_counts.items()
            if k[0] not in stale_tracks
        }
        self._last_alert_time = {
            k: v for k, v in self._last_alert_time.items()
            if k[0] not in stale_tracks
        }
        for t_id in stale_tracks:
            self._last_seen_track.pop(t_id, None)

    def check(
        self, 
        camera_id: str, 
        tracks: List[dict], 
        zones: List[dict],
        frame_width: int = 640,
        frame_height: int = 480
    ) -> List[dict]:
        """
        Args:
            camera_id: ID của camera.
            tracks: List các track [{track_id, bbox, label...}].
            zones: List các zone [{id, name, polygon_coords, severity...}].
            frame_width: Chiều rộng frame để scale tọa độ chuẩn hóa nếu có.
            frame_height: Chiều cao frame để scale tọa độ chuẩn hóa nếu có.
        """
        now = time.time()
        violations = []

        self._cleanup_stale_tracks(now)

        if not zones or not tracks:
            return violations

        # Tiền xử lý các zones: scale tọa độ nếu là normalized (0.0-1.0) và tính AABB
        prepared_zones = []
        for zone in zones:
            polygon_coords = zone.get("polygon_coords", [])
            if len(polygon_coords) < 3:
                continue

            # Kiểm tra xem tọa độ có phải là normalized (tất cả điểm <= 1.0)
            is_normalized = all(
                0.0 <= pt[0] <= 1.0 and 0.0 <= pt[1] <= 1.0 
                for pt in polygon_coords
            )

            if is_normalized:
                scaled_poly = [
                    [pt[0] * frame_width, pt[1] * frame_height]
                    for pt in polygon_coords
                ]
            else:
                scaled_poly = polygon_coords

            poly_np = np.array(scaled_poly, dtype=np.float32)
            min_x = float(np.min(poly_np[:, 0]))
            max_x = float(np.max(poly_np[:, 0]))
            min_y = float(np.min(poly_np[:, 1]))
            max_y = float(np.max(poly_np[:, 1]))

            poly_int_np = np.array(scaled_poly, dtype=np.int32).reshape((-1, 1, 2))

            prepared_zones.append({
                "id": str(zone.get("id")),
                "name": zone.get("name", "Vùng cấm"),
                "severity": zone.get("severity", "CRITICAL"),
                "poly_np": poly_int_np,
                "aabb": (min_x, min_y, max_x, max_y),
            })

        for trk in tracks:
            track_id = str(trk.get("track_id"))
            self._last_seen_track[track_id] = now

            # Chỉ kiểm tra cho person hoặc object có bbox
            label = str(trk.get("label", "")).lower()
            if label and label not in ["person", "worker", "human", "zone_intrusion"] and not trk.get("is_person", True):
                # Bỏ qua nếu là vật thể khác như helmet/vest riêng lẻ
                if label in ["helmet", "no_helmet", "vest", "no_vest"]:
                    continue

            bbox = trk.get("bbox")
            if not bbox or len(bbox) < 4:
                continue

            x1, y1, x2, y2 = bbox
            foot_point = (float((x1 + x2) / 2.0), float(y2))
            fx, fy = foot_point

            for pz in prepared_zones:
                zone_id = pz["id"]
                min_x, min_y, max_x, max_y = pz["aabb"]

                # 1. AABB Pre-filter: Nếu điểm chân nằm ngoài hình chữ nhật bao -> bỏ qua test đa giác
                if fx < min_x or fx > max_x or fy < min_y or fy > max_y:
                    key = (track_id, zone_id)
                    if key in self._inside_counts:
                        self._inside_counts[key] = 0
                    continue

                # 2. Point-in-polygon test (chỉ chạy khi điểm nằm trong AABB)
                is_inside = cv2.pointPolygonTest(pz["poly_np"], foot_point, False) >= 0

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
                            "severity_level": pz["severity"],
                            "camera_id": camera_id,
                            "track_id": track_id,
                            "zone_name": pz["name"],
                            "bbox": bbox,
                            "confidence": trk.get("confidence", 1.0),
                            "timestamp": now,
                        })
                else:
                    self._inside_counts[key] = 0

        return violations

