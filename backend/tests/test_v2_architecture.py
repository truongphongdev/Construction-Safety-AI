import numpy as np
import pytest
from app.ai.local_client import LocalPPEClient
from analytics.ppe_checker import PPEChecker
from analytics.zone_checker import ZoneChecker
from app.core.event_bus import EventBus
from app.core.auth import create_access_token, decode_token, hash_password, verify_password

def test_local_client():
    client = LocalPPEClient()
    blank_img = np.zeros((480, 640, 3), dtype=np.uint8)
    detections = client.detect(blank_img)
    assert isinstance(detections, list)

def test_ppe_checker_cooldown():
    checker = PPEChecker(cooldown_seconds=10.0)
    tracks = [
        {"track_id": "cam1-100", "bbox": [10, 10, 50, 50], "label": "no_helmet", "confidence": 0.9}
    ]
    # Lần 1: Bắn event
    events1 = checker.check("cam-1", tracks)
    assert len(events1) == 1
    assert events1[0]["violation_type"] == "NO_HELMET"

    # Lần 2 (ngay lập tức): Cooldown chặn event
    events2 = checker.check("cam-1", tracks)
    assert len(events2) == 0

def test_zone_checker_debounce():
    checker = ZoneChecker(debounce_frames=3, cooldown_seconds=10.0)
    zones = [
        {
            "id": "zone-1",
            "name": "Vùng Cấm Vận Hành",
            "polygon_coords": [[0, 0], [200, 0], [200, 200], [0, 200]],
            "severity": "CRITICAL"
        }
    ]

    tracks = [
        {"track_id": "cam1-200", "bbox": [50, 50, 100, 100], "confidence": 0.95}  # Chân người tại (75, 100) -> trong zone
    ]

    # Frame 1 & 2: Chưa chạm threshold debounce 3 frame
    assert len(checker.check("cam-1", tracks, zones)) == 0
    assert len(checker.check("cam-1", tracks, zones)) == 0

    # Frame 3: Đạt 3 frame -> Bắn event
    events = checker.check("cam-1", tracks, zones)
    assert len(events) == 1
    assert events[0]["event_type"] == "ZONE_INTRUSION"

def test_event_bus():
    bus = EventBus()
    bus.publish({"event_type": "TEST_EVENT", "data": 123})
    import time
    msg = None
    for _ in range(20):
        msg = bus.consume(block=False)
        if msg is not None:
            break
        time.sleep(0.01)
    assert msg is not None
    assert msg["event_type"] == "TEST_EVENT"

def test_jwt_auth():
    pwd = "MySecretPassword123"
    hashed = hash_password(pwd)
    assert verify_password(pwd, hashed)

    token = create_access_token({"sub": "user-uuid-123", "role": "ADMIN"})
    payload = decode_token(token)
    assert payload["sub"] == "user-uuid-123"
    assert payload["role"] == "ADMIN"
