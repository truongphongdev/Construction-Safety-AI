"""
constants.py — Hằng số dùng chung trong toàn bộ hệ thống backend.
"""

# Tập hợp các nhãn vi phạm an toàn — khớp với mô hình YOLOv8 đã huấn luyện
VIOLATION_LABELS: set[str] = {"no_helmet", "no_vest", "zone_intrusion", "fall"}
