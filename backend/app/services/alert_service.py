"""
AlertService — Quản lý lưu trữ và truy xuất cảnh báo vi phạm.
Hiện dùng in-memory store. Sẽ thay bằng database (PostgreSQL/SQLite) sau.
"""

import uuid
from datetime import datetime
from typing import List

from app.schemas.alert import Alert, AlertList, AlertSeverity, ViolationType


class AlertService:
    def __init__(self):
        # In-memory store — thay bằng DB session khi production
        self._store: List[Alert] = []

    def create_alert(
        self,
        violation_type: ViolationType,
        confidence: float,
        severity: AlertSeverity = AlertSeverity.MEDIUM,
        camera_id: str | None = None,
        image_snapshot_url: str | None = None,
        notes: str | None = None,
    ) -> Alert:
        """Tạo và lưu một cảnh báo mới."""
        alert = Alert(
            id=str(uuid.uuid4()),
            violation_type=violation_type,
            severity=severity,
            confidence=confidence,
            camera_id=camera_id,
            timestamp=datetime.utcnow(),
            image_snapshot_url=image_snapshot_url,
            notes=notes,
        )
        self._store.append(alert)
        return alert

    def get_alerts(self, limit: int = 20, offset: int = 0) -> AlertList:
        """Trả về danh sách cảnh báo, sắp xếp mới nhất trước."""
        sorted_alerts = sorted(self._store, key=lambda a: a.timestamp, reverse=True)
        page = sorted_alerts[offset : offset + limit]
        return AlertList(
            total=len(self._store),
            offset=offset,
            limit=limit,
            items=page,
        )

    def delete_alert(self, alert_id: str) -> bool:
        """Xóa cảnh báo theo ID. Trả về True nếu tìm thấy và xóa thành công."""
        original_len = len(self._store)
        self._store = [a for a in self._store if a.id != alert_id]
        return len(self._store) < original_len
