"""
gRPC Camera/Video Stream Client Demo — Construction Safety AI
Giả lập Camera Ingest hoặc Video Streamer đọc ảnh/video -> gửi gRPC stream liên tục tới Backend gRPC Server.
"""

import sys
import time
import logging
from pathlib import Path

import cv2
import numpy as np
import grpc

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.proto import camera_stream_pb2, camera_stream_pb2_grpc
from app.utils.image_utils import numpy_to_bytes, bytes_to_numpy

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CameraClientDemo")


def generate_dummy_frame(width=640, height=480, frame_idx=0) -> np.ndarray:
    """Tạo 1 frame giả lập chứa hình chữ nhật di chuyển để test stream."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    # Background gradient
    img[:, :] = (30, 30, 40)
    
    # Text
    cv2.putText(
        img,
        f"Construction Site Camera #1 - Frame {frame_idx}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )

    # Simulated worker moving
    x = int((frame_idx * 10) % (width - 100)) + 50
    y = 200
    cv2.rectangle(img, (x, y), (x + 60, y + 140), (200, 150, 50), -1)
    cv2.putText(img, "Worker", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    return img


def frame_generator(camera_id="CAM_ZONE_01", total_frames=20, fps=10):
    """Generator hàm gửi từng FrameRequest qua gRPC stream."""
    delay = 1.0 / fps
    for i in range(1, total_frames + 1):
        img_np = generate_dummy_frame(frame_idx=i)
        img_bytes = numpy_to_bytes(img_np, format=".jpg")

        request = camera_stream_pb2.FrameRequest(
            camera_id=camera_id,
            timestamp=int(time.time() * 1000),
            image_bytes=img_bytes,
            image_format="jpeg",
            frame_id=i
        )
        logger.info(f"📤 [SEND] Frame #{i} ({len(img_bytes)} bytes)...")
        yield request
        time.sleep(delay)


def run_bidi_stream_demo(target="localhost:50051", total_frames=15):
    """Kết nối gRPC Bidirectional Stream tới Server."""
    logger.info(f"Đang kết nối gRPC channel tới {target}...")
    channel = grpc.insecure_channel(target)
    stub = camera_stream_pb2_grpc.CameraStreamServiceStub(channel)

    try:
        # Gọi LiveCameraInference Bidirectional Stream
        responses = stub.LiveCameraInference(frame_generator(total_frames=total_frames, fps=5))

        for resp in responses:
            logger.info(
                f"📥 [RECV] Frame #{resp.frame_id} | Violations: {resp.total_violations} | "
                f"Inference: {resp.inference_time_ms}ms | Objects: {len(resp.detected_objects)}"
            )
            for obj in resp.detected_objects:
                bbox = obj.bbox
                logger.info(
                    f"   └─ Object: {obj.label} ({obj.confidence:.2f}) at [{bbox.xmin:.1f}, {bbox.ymin:.1f}, {bbox.xmax:.1f}, {bbox.ymax:.1f}] "
                    f"Vi phạm: {'[CẢNH BÁO]' if obj.is_violation else '[OK]'}"
                )
    except grpc.RpcError as e:
        logger.error(f"Lỗi kết nối gRPC RPC: {e}")
    finally:
        channel.close()
        logger.info("Đã hoàn tất thử nghiệm gRPC Stream Demo!")


if __name__ == "__main__":
    target_address = "localhost:50051"
    if len(sys.argv) > 1:
        target_address = sys.argv[1]
    run_bidi_stream_demo(target=target_address)
