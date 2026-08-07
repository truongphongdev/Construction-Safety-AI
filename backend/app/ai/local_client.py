import logging
from pathlib import Path
import numpy as np

from app.config import get_settings
from ai.detector import YOLODetector

logger = logging.getLogger(__name__)
settings = get_settings()

LABELS = {
    0: "helmet",
    1: "no_helmet",
    2: "vest",
    3: "no_vest",
    4: "person",
}

class LocalPPEClient:
    """
    Client chạy YOLOv8 local trực tiếp để phát hiện PPE (không dùng Triton).
    """

    def __init__(
        self,
        conf_thresh: float = 0.25,
        iou_thresh: float = 0.45,
    ):
        self.conf_thresh = conf_thresh
        self.iou_thresh = iou_thresh
        self.detector = None
        self._init_detector()

    def _init_detector(self):
        try:
            base_dir = Path(__file__).resolve().parent.parent.parent
            model_path = base_dir / "ppe_5classes_model_results" / "weights" / "best.pt"
            if not model_path.exists():
                model_path = base_dir / "ai" / "weights" / "best.pt"
            
            if not model_path.exists():
                model_path = base_dir / settings.MODEL_PATH

            if model_path.exists():
                self.detector = YOLODetector(
                    model_path=str(model_path), 
                    conf=self.conf_thresh, 
                    iou=self.iou_thresh,
                    device=settings.DEVICE
                )
                logger.info(f"Đã khởi tạo local YOLO detector: {model_path}")
            else:
                logger.error("Không tìm thấy weights model local.")
        except Exception as err:
            logger.error(f"Lỗi khởi tạo local detector: {err}")

    def detect(self, image: np.ndarray) -> list[dict]:
        """
        Dự đoán trên 1 khung hình BGR numpy.
        Trả về list dict dạng:
        [
            {
                "bbox": [x1, y1, x2, y2],
                "confidence": float,
                "class_id": int,
                "label": str
            }
        ]
        """
        if self.detector is None:
            logger.error("Detector chưa được khởi tạo thành công.")
            return []

        try:
            results = self.detector.predict(image)
            detections = []
            if results and len(results) > 0:
                res = results[0]
                boxes = res.boxes
                for box in boxes:
                    xyxy = box.xyxy[0].cpu().numpy().tolist()
                    conf = float(box.conf[0].cpu().numpy())
                    cls_id = int(box.cls[0].cpu().numpy())
                    label = LABELS.get(cls_id, f"class_{cls_id}")
                    detections.append({
                        "bbox": [round(c, 2) for c in xyxy],
                        "confidence": round(conf, 4),
                        "class_id": cls_id,
                        "label": label
                    })
            return detections
        except Exception as e:
            logger.error(f"Lỗi chạy inference local: {e}")
            return []
