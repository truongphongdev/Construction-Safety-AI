"""
gRPC Server cho Construction Safety AI — Stream nhận/gửi ảnh từ Camera & Video
Sử dụng High-Performance HTTP/2 Streaming với Protocol Buffers
"""

import sys
import time
import logging
from concurrent import futures
from pathlib import Path

import cv2
import numpy as np
import grpc

# Thêm path tới backend
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Import proto stubs
try:
    from app.proto import camera_stream_pb2, camera_stream_pb2_grpc
except ImportError:
    print("[WARNING] Proto stubs chưa được sinh ra. Vui lòng chạy scripts/gen_proto.py trước.")

# Import AI Detector & utils
from app.utils.image_utils import bytes_to_numpy, numpy_to_bytes
from app.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("gRPCServer")

from app.core.constants import VIOLATION_LABELS



class CameraStreamServicer(camera_stream_pb2_grpc.CameraStreamServiceServicer):
    """
    gRPC Service Handler triển khai các RPCs của CameraStreamService.
    """

    def __init__(self):
        self.settings = get_settings()
        self.detector = None
        self._init_detector()

    def _init_detector(self):
        """Khởi tạo mô hình YOLOv8 nếu file weights khả dụng."""
        try:
            # Kiểm tra weights trong ppe_5classes_model_results hoặc backend/ai/weights
            model_path = Path("ppe_5classes_model_results/weights/best.pt")
            if not model_path.exists():
                model_path = Path(self.settings.MODEL_PATH)
            
            if model_path.exists():
                from ai.detector import YOLODetector
                logger.info(f"Đang tải mô hình YOLOv8 từ: {model_path}")
                self.detector = YOLODetector(
                    model_path=str(model_path),
                    conf=self.settings.CONFIDENCE_THRESHOLD,
                    iou=self.settings.IOU_THRESHOLD,
                    device=self.settings.DEVICE,
                )
                logger.info("Tải mô hình YOLOv8 thành công!")
            else:
                logger.warning(f"Không tìm thấy file weights tại {model_path}. Sẽ dùng chế độ Mock Detection.")
        except Exception as e:
            logger.error(f"Lỗi khi khởi tạo YOLOv8 Detector: {e}. Dùng chế độ Mock Detection.")

    def _process_frame(self, request: camera_stream_pb2.FrameRequest) -> camera_stream_pb2.StreamFrameResponse:
        """
        Xử lý 1 frame duy nhất: Giải mã ảnh -> YOLO Inference -> Draw BBoxes -> Trả về Response.
        """
        t0 = time.perf_counter()
        
        if not request.image_bytes:
            return camera_stream_pb2.StreamFrameResponse(
                camera_id=request.camera_id,
                timestamp=request.timestamp,
                frame_id=request.frame_id,
                total_violations=0,
                inference_time_ms=0.0
            )

        # 1. Giải mã bytes sang numpy array (BGR)
        image_np = bytes_to_numpy(request.image_bytes)
        annotated_image = image_np.copy()
        detected_pb_list = []
        violations_count = 0


        # 2. Inference
        if self.detector is not None:
            raw_results = self.detector.predict(image_np)
            # Lấy class names từ model thực tế (ưu tiên model.names)
            model_names = raw_results[0].names if raw_results else self.detector.DEFAULT_LABELS

            for res in raw_results:
                boxes = res.boxes
                for box in boxes:
                    xyxy = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    # Dùng tên nhãn từ model thực tế
                    label = model_names.get(cls_id, f"class_{cls_id}")

                    is_violation = label in VIOLATION_LABELS
                    if is_violation:
                        violations_count += 1

                    # Bounding Box Proto
                    bbox_pb = camera_stream_pb2.BoundingBoxProto(
                        xmin=xyxy[0], ymin=xyxy[1], xmax=xyxy[2], ymax=xyxy[3]
                    )
                    detected_pb_list.append(
                        camera_stream_pb2.DetectedObjectProto(
                            label=label,
                            confidence=conf,
                            bbox=bbox_pb,
                            is_violation=is_violation
                        )
                    )

                    x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                    # Xanh lá (BGR: 0,200,60) = an toàn | Đỏ (BGR: 0,50,230) = vi phạm
                    color = (30, 30, 220) if is_violation else (30, 180, 30)
                    thickness = 2

                    # Vẽ bounding box
                    cv2.rectangle(annotated_image, (x1, y1), (x2, y2), color, thickness, lineType=cv2.LINE_AA)

                    # Label text + filled background
                    text = f"{label}  {conf:.0%}"
                    font_scale = 0.52
                    font = cv2.FONT_HERSHEY_SIMPLEX
                    (tw, th), baseline = cv2.getTextSize(text, font, font_scale, 1)
                    label_y1 = max(0, y1 - th - 6)
                    label_y2 = y1
                    cv2.rectangle(annotated_image, (x1, label_y1), (x1 + tw + 6, label_y2), color, -1)
                    cv2.putText(
                        annotated_image, text,
                        (x1 + 3, max(th + 2, y1 - 3)),
                        font, font_scale, (255, 255, 255), 1, cv2.LINE_AA
                    )
        else:
            # Mock Detection nếu chưa có mô hình — vẽ hộp giả để test giao diện
            h, w = image_np.shape[:2]
            mock_bbox = camera_stream_pb2.BoundingBoxProto(
                xmin=w * 0.2, ymin=h * 0.2, xmax=w * 0.6, ymax=h * 0.8
            )
            detected_pb_list.append(
                camera_stream_pb2.DetectedObjectProto(
                    label="no_helmet",
                    confidence=0.92,
                    bbox=mock_bbox,
                    is_violation=True
                )
            )
            violations_count = 1
            cv2.rectangle(annotated_image, (int(w*0.2), int(h*0.2)), (int(w*0.6), int(h*0.8)), (30, 30, 220), 2, cv2.LINE_AA)
            cv2.rectangle(annotated_image, (int(w*0.2), int(h*0.2)-26), (int(w*0.2)+160, int(h*0.2)), (30, 30, 220), -1)
            cv2.putText(annotated_image, "no_helmet 92% [MOCK]",
                (int(w*0.2)+3, int(h*0.2)-6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

        # 3. Encode ảnh annotated lại thành bytes (JPEG)
        annotated_bytes = numpy_to_bytes(annotated_image, format=".jpg")
        inference_ms = (time.perf_counter() - t0) * 1000


        return camera_stream_pb2.StreamFrameResponse(
            camera_id=request.camera_id,
            timestamp=request.timestamp,
            frame_id=request.frame_id,
            detected_objects=detected_pb_list,
            total_violations=violations_count,
            inference_time_ms=round(inference_ms, 2),
            annotated_image_bytes=annotated_bytes
        )

    def DetectSingleFrame(self, request, context):
        """Unary RPC: Nhận 1 frame -> Trả về 1 response."""
        return self._process_frame(request)

    def UploadCameraStream(self, request_iterator, context):
        """Client Streaming: Nhận luồng frame liên tục -> Trả kết quả frame cuối."""
        last_response = None
        count = 0
        for request in request_iterator:
            count += 1
            last_response = self._process_frame(request)
        logger.info(f"Đã xử lý client stream gồm {count} frames.")
        return last_response or camera_stream_pb2.StreamFrameResponse()

    def LiveCameraInference(self, request_iterator, context):
        """
        Bidirectional Streaming (gRPC Streaming Thực Tế):
        Nhận từng frame từ Camera Stream -> Chạy YOLO Inference -> Stream trả kết quả từng frame realtime.
        """
        logger.info("Bắt đầu kết nối Bidirectional Stream với Camera/Client...")
        frame_count = 0
        for request in request_iterator:
            frame_count += 1
            response = self._process_frame(request)
            yield response
        logger.info(f"Kết thúc Bidirectional Stream cho camera. Tổng frame xử lý: {frame_count}")


def serve(port: int = 50051):
    """Khởi chạy gRPC Server."""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    camera_stream_pb2_grpc.add_CameraStreamServiceServicer_to_server(
        CameraStreamServicer(), server
    )
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    logger.info(f"🚀 gRPC Server đang chạy trên port :{port}...")
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Đang dừng gRPC Server...")
        server.stop(0)


if __name__ == "__main__":
    port = 50051
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    serve(port)
