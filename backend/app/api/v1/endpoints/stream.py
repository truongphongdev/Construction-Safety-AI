import time
import json
import asyncio
import logging
import base64
import cv2
import numpy as np
from typing import List, Set
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse

from app.config import BASE_DIR
from workers.camera_worker import get_latest_mjpeg_frame
from workers.worker_manager import global_worker_manager
from workers.event_consumer import register_ws_callback, global_event_consumer
from app.ai.local_client import get_local_ppe_client
from analytics.ppe_checker import PPEChecker
from analytics.zone_checker import ZoneChecker
from app.core.event_bus import global_event_bus

logger = logging.getLogger(__name__)

router = APIRouter()

VIDEO_DEMO_DIR = BASE_DIR.parent / "video_demo"

# Thư viện lưu trữ các WebSocket clients đang lắng nghe WebSocket alerts
connected_alert_clients: Set[WebSocket] = set()
event_loop = None

def broadcast_ws_alert(alert_data: dict):
    """Callback được gọi từ EventConsumerThread khi có vi phạm mới."""
    if not connected_alert_clients:
        return

    payload = json.dumps(alert_data)
    # Lấy event loop chính của FastAPI để gửi message async
    global event_loop
    if event_loop and event_loop.is_running():
        asyncio.run_coroutine_threadsafe(_send_to_all_clients(payload), event_loop)

async def _send_to_all_clients(payload: str):
    disconnected = set()
    for ws in list(connected_alert_clients):
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.add(ws)

    for ws in disconnected:
        connected_alert_clients.discard(ws)

# Đăng ký callback broadcast ngay khi load module
register_ws_callback(broadcast_ws_alert)

# Đảm bảo Event Consumer Thread chạy
global_event_consumer.start()


@router.get("/videos", summary="Danh sách video demo có sẵn")
def list_videos():
    """Liệt kê file video trong thư mục video_demo/."""
    videos = []
    if VIDEO_DEMO_DIR.exists():
        for f in VIDEO_DEMO_DIR.iterdir():
            if f.suffix.lower() in (".mp4", ".avi", ".mov", ".mkv"):
                videos.append({"name": f.stem, "filename": f.name})
    return {"videos": videos, "demo_dir": str(VIDEO_DEMO_DIR)}


def mjpeg_frame_generator(camera_id: str, video_source: str = None):
    """
    Generator tạo luồng MJPEG HTTP stream cho camera_id khi có nguồn video cụ thể.
    """
    if video_source:
        status_map = global_worker_manager.get_status()
        if not status_map.get(camera_id, False):
            global_worker_manager.start_worker(camera_id, video_source)

    while True:
        frame_bytes = get_latest_mjpeg_frame(camera_id)
        if frame_bytes is not None:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            )
        else:
            time.sleep(0.05)

        time.sleep(0.03)  # ~30 FPS output limit


@router.get("/stream/{camera_id}", summary="MJPEG Video Stream cho camera")
def get_mjpeg_stream(camera_id: str, video_name: str = None):
    """
    Endpoint trả về Server-Side MJPEG stream.
    Trình duyệt chỉ cần dùng thẻ <img src="/stream/camera_id" /> để hiển thị trực tiếp.
    """
    source = None
    if video_name:
        video_path = VIDEO_DEMO_DIR / video_name
        if video_path.exists():
            source = str(video_path)

    return StreamingResponse(
        mjpeg_frame_generator(camera_id, video_source=source),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """
    WebSocket endpoint chuyên biệt chỉ phục vụ gửi cảnh báo real-time tới Dashboard.
    Client không cần gửi frame qua WebSocket nữa.
    """
    global event_loop
    event_loop = asyncio.get_running_loop()

    await websocket.accept()
    connected_alert_clients.add(websocket)
    logger.info(f"[WS Alerts] Client đã kết nối: {websocket.client}")

    try:
        while True:
            # Giữ kết nối alive (ping/pong)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info(f"[WS Alerts] Client đã ngắt kết nối: {websocket.client}")
    finally:
        connected_alert_clients.discard(websocket)


from collections import deque
webcam_ppe_checkers = {}
webcam_zone_checkers = {}
webcam_frame_buffers = {}

@router.post("/webcam/{camera_id}", summary="Nhận frame từ webcam máy tính và chạy AI")
async def process_webcam_frame(camera_id: str, file: UploadFile = File(...)):
    """
    Nhận frame JPEG từ webcam của client, chạy YOLOv8 Triton,
    kiểm tra PPE + Zone, đẩy event vi phạm ra EventBus,
    và trả về ảnh overlay base64 kèm danh sách objects.
    """
    img_bytes = await file.read()
    nparr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Không thể decode ảnh.")

    # Cấu hình / Lấy checkers & buffers (5s cooldown, 6s video buffer)
    if camera_id not in webcam_ppe_checkers:
        webcam_ppe_checkers[camera_id] = PPEChecker(cooldown_seconds=5.0)
        webcam_zone_checkers[camera_id] = ZoneChecker(debounce_frames=2, cooldown_seconds=5.0)
        webcam_frame_buffers[camera_id] = deque(maxlen=30)  # Buffer 6 giây (30 frames @ 5 FPS)

    ppe_checker = webcam_ppe_checkers[camera_id]
    zone_checker = webcam_zone_checkers[camera_id]
    frame_buf = webcam_frame_buffers[camera_id]

    # Nhận diện qua local client singleton (tránh nạp lại model từ ổ đĩa)
    local_client = get_local_ppe_client()
    loop = asyncio.get_running_loop()
    detections = await loop.run_in_executor(None, local_client.detect, frame)

    # Đưa vào track list mô phỏng
    tracks = []
    for idx, det in enumerate(detections):
        tracks.append({
            "track_id": f"webcam-{idx}",
            "bbox": det["bbox"],
            "label": det["label"],
            "confidence": det["confidence"]
        })

    # Phân tích vi phạm
    ppe_events = ppe_checker.check(camera_id, tracks)
    
    # Tìm vùng cấm cho camera_id (nếu có, với TTL cache 30s)
    now = time.time()
    zones = []
    cached_zone_data = webcam_zone_checkers.get(f"{camera_id}_zones")
    if cached_zone_data and (now - cached_zone_data["time"] < 30.0):
        zones = cached_zone_data["zones"]
    else:
        from app.core.database import SessionLocal
        from app.models.zone import ZoneModel
        import uuid
        db = SessionLocal()
        try:
            cam_uuid = uuid.UUID(camera_id) if len(camera_id) == 36 else uuid.UUID("00000000-0000-0000-0000-000000000001")
            zones_db = db.query(ZoneModel).filter(ZoneModel.camera_id == cam_uuid, ZoneModel.is_active == True).all()
            zones = [{"id": str(z.id), "name": z.name, "polygon_coords": z.polygon_coords, "severity": z.severity} for z in zones_db]
            webcam_zone_checkers[f"{camera_id}_zones"] = {"zones": zones, "time": now}
        except Exception:
            pass
        finally:
            db.close()

    zone_events = zone_checker.check(camera_id, tracks, zones)

    # Vẽ overlay lên hình ảnh
    annotated = frame.copy()
    for trk in tracks:
        x1, y1, x2, y2 = [int(v) for v in trk["bbox"]]
        lbl = trk["label"]
        conf = trk["confidence"]
        
        lbl_clean = str(lbl).lower().replace("-", "_").replace(" ", "_")
        is_safe = lbl_clean in ["helmet", "vest"]
        color = (0, 255, 0) if is_safe else (0, 0, 255)
        
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            annotated,
            f"{lbl} {conf:.2f}",
            (x1, max(y1 - 10, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            color,
            2
        )

    # Lưu frame vào buffer
    frame_buf.append(annotated.copy())

    # Đẩy các vi phạm mới vào event bus kèm video frames
    all_events = ppe_events + zone_events
    if all_events:
        buffered_frames = list(frame_buf) if len(frame_buf) > 0 else [annotated.copy()]
        for evt in all_events:
            evt["frame_jpg"] = annotated.copy()
            evt["video_frames"] = buffered_frames
            evt["fps"] = 5.0
            global_event_bus.publish(evt)

    # Convert annotated image back to base64 với JPEG quality 85% cho độ nét cao
    ret, jpeg_buf = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    base64_img = ""
    if ret:
        base64_img = f"data:image/jpeg;base64,{base64.b64encode(jpeg_buf).decode('utf-8')}"

    return {
        "annotated_image": base64_img,
        "total_violations": len(ppe_events) + len(zone_events),
        "detected_objects": [
            {
                "label": trk["label"],
                "confidence": trk["confidence"],
                "bbox": trk["bbox"],
                "is_violation": str(trk["label"]).lower().replace("-", "_") in ["no_helmet", "no_vest", "no_hardhat", "fall", "zone_intrusion"]
            } for trk in tracks
        ]
    }
