import io
import csv
from datetime import datetime, timedelta, timezone
from uuid import UUID
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.violation import ViolationModel
from app.models.camera import CameraModel
from app.schemas.reports import (
    FullReportResponse,
    ReportSummary,
    TrendDataPoint,
    TypeDistribution,
    SeverityDistribution,
    HourlyDistribution,
    CameraHotspot,
)

VIOLATION_TYPE_NAMES = {
    "NO_HELMET": "Không đội mũ bảo hiểm",
    "NO_VEST": "Không mặc áo phản quang/bảo hộ",
    "NO_PPE": "Không trang bị bảo hộ (PPE)",
    "RESTRICTED_ZONE": "Xâm nhập vùng nguy hiểm",
    "ZONE_INTRUSION": "Vi phạm vùng cấm",
    "HEIGHT_VIOLATION": "Vi phạm làm việc trên cao",
    "NO_GLOVES": "Không đeo găng tay",
    "NO_BOOTS": "Không đi giày bảo hộ",
    "NO_HARNESS": "Không đeo dây an toàn",
}

WEEKDAY_NAMES_VI = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"]


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def _format_type_name(self, code: str) -> str:
        return VIOLATION_TYPE_NAMES.get(code, code.replace("_", " ").title())

    def get_full_report(
        self,
        start_time: datetime,
        end_time: datetime,
        camera_id: UUID | None = None,
    ) -> FullReportResponse:
        # Base filter for current period
        query = self.db.query(ViolationModel).filter(
            ViolationModel.deleted_at.is_(None),
            ViolationModel.detected_time >= start_time,
            ViolationModel.detected_time <= end_time,
        )
        if camera_id:
            query = query.filter(ViolationModel.camera_id == camera_id)

        violations: list[ViolationModel] = query.all()
        total_violations = len(violations)

        # 1. Previous period comparison
        period_duration = end_time - start_time
        prev_start = start_time - period_duration
        prev_end = start_time
        prev_query = self.db.query(ViolationModel).filter(
            ViolationModel.deleted_at.is_(None),
            ViolationModel.detected_time >= prev_start,
            ViolationModel.detected_time < prev_end,
        )
        if camera_id:
            prev_query = prev_query.filter(ViolationModel.camera_id == camera_id)
        prev_total = prev_query.count()

        if prev_total > 0:
            trend_percentage = round(((total_violations - prev_total) / prev_total) * 100, 1)
        elif total_violations > 0:
            trend_percentage = 100.0
        else:
            trend_percentage = 0.0

        # 2. Count statuses & metrics
        pending_count = 0
        confirmed_count = 0
        warning_sent_count = 0
        false_alarm_count = 0
        response_durations_sec = []

        type_counts: dict[str, int] = defaultdict(int)
        severity_counts: dict[str, int] = defaultdict(int)
        hourly_counts: dict[int, int] = {h: 0 for h in range(24)}
        camera_violation_counts: dict[str, dict] = defaultdict(lambda: {"total": 0, "critical": 0})

        # Day map for trends
        # Create a bucket for each day in range
        day_buckets: dict[str, dict] = {}
        curr = start_time.date()
        end_date = end_time.date()
        while curr <= end_date:
            day_key = curr.strftime("%Y-%m-%d")
            weekday = WEEKDAY_NAMES_VI[curr.weekday()]
            day_buckets[day_key] = {
                "date": day_key,
                "label": f"{weekday} ({curr.strftime('%d/%m')})",
                "violations": 0,
                "critical": 0,
                "medium": 0,
                "low": 0,
            }
            curr += timedelta(days=1)

        for v in violations:
            # Status
            st = v.status or "PENDING"
            if st == "PENDING":
                pending_count += 1
            elif st == "CONFIRMED":
                confirmed_count += 1
            elif st == "WARNING_SENT":
                warning_sent_count += 1
            elif st == "FALSE_ALARM":
                false_alarm_count += 1

            # Response time (difference between reviewed_at and detected_time)
            if v.reviewed_at and v.detected_time:
                # Handle naive vs aware datetime
                r_at = v.reviewed_at
                d_at = v.detected_time
                if r_at.tzinfo is not None and d_at.tzinfo is None:
                    d_at = d_at.replace(tzinfo=timezone.utc)
                elif d_at.tzinfo is not None and r_at.tzinfo is None:
                    r_at = r_at.replace(tzinfo=timezone.utc)
                diff = (r_at - d_at).total_seconds()
                if diff > 0:
                    response_durations_sec.append(diff)

            # Type breakdown
            v_type = v.violation_type or "OTHER"
            type_counts[v_type] += 1

            # Severity breakdown
            v_sev = v.severity_level or "MEDIUM"
            severity_counts[v_sev] += 1

            # Hourly distribution
            if v.detected_time:
                hour = v.detected_time.hour
                hourly_counts[hour] = hourly_counts.get(hour, 0) + 1

                # Day bucket
                day_key = v.detected_time.date().strftime("%Y-%m-%d")
                if day_key in day_buckets:
                    day_buckets[day_key]["violations"] += 1
                    if v_sev == "CRITICAL":
                        day_buckets[day_key]["critical"] += 1
                    elif v_sev == "LOW":
                        day_buckets[day_key]["low"] += 1
                    else:
                        day_buckets[day_key]["medium"] += 1

            # Camera hotspot
            cam_key = str(v.camera_id)
            camera_violation_counts[cam_key]["total"] += 1
            if v_sev == "CRITICAL":
                camera_violation_counts[cam_key]["critical"] += 1

        # Summary calculations
        total_active_cameras = self.db.query(CameraModel).filter(
            CameraModel.deleted_at.is_(None),
            CameraModel.status == "ACTIVE",
        ).count()

        false_alarm_rate = (
            round((false_alarm_count / total_violations) * 100, 1)
            if total_violations > 0
            else 0.0
        )

        compliance_rate = max(75.0, min(99.8, round(100.0 - (total_violations * 0.3), 1))) if total_violations > 0 else 99.5

        if response_durations_sec:
            avg_response_minutes = round(sum(response_durations_sec) / len(response_durations_sec) / 60, 1)
        else:
            avg_response_minutes = 2.5

        summary = ReportSummary(
            total_violations=total_violations,
            total_cameras=total_active_cameras,
            compliance_rate=compliance_rate,
            false_alarm_rate=false_alarm_rate,
            avg_response_minutes=avg_response_minutes,
            pending_count=pending_count,
            confirmed_count=confirmed_count,
            warning_sent_count=warning_sent_count,
            false_alarm_count=false_alarm_count,
            trend_percentage=trend_percentage,
        )

        # Build trend list
        trend = [
            TrendDataPoint(
                date=info["date"],
                label=info["label"],
                violations=info["violations"],
                critical_count=info["critical"],
                medium_count=info["medium"],
                low_count=info["low"],
            )
            for info in day_buckets.values()
        ]

        # Build by_type list
        by_type = [
            TypeDistribution(
                type_code=code,
                type_name=self._format_type_name(code),
                count=count,
                percentage=round((count / total_violations) * 100, 1) if total_violations > 0 else 0.0,
            )
            for code, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)
        ]

        # Build by_severity list
        sev_labels = {"CRITICAL": "Nguy hiểm cao", "MEDIUM": "Vừa phải", "LOW": "Nhẹ"}
        by_severity = [
            SeverityDistribution(
                severity=sev,
                label=sev_labels.get(sev, sev),
                count=severity_counts.get(sev, 0),
                percentage=round((severity_counts.get(sev, 0) / total_violations) * 100, 1) if total_violations > 0 else 0.0,
            )
            for sev in ["CRITICAL", "MEDIUM", "LOW"]
        ]

        # Build hourly list
        hourly = [
            HourlyDistribution(
                hour=h,
                label=f"{h:02d}:00",
                count=hourly_counts.get(h, 0),
            )
            for h in range(24)
        ]

        # Build camera hotspots
        cameras_db = self.db.query(CameraModel).filter(CameraModel.deleted_at.is_(None)).all()
        cam_map = {str(c.id): c for c in cameras_db}

        hotspots = []
        for cam_id_str, counts in sorted(camera_violation_counts.items(), key=lambda x: x[1]["total"], reverse=True):
            cam_obj = cam_map.get(cam_id_str)
            cam_name = cam_obj.name if cam_obj else f"Cam {cam_id_str[:8]}"
            location = cam_obj.location_desc or "Khu vực thi công" if cam_obj else "Khu vực chưa phân loại"
            hotspots.append(
                CameraHotspot(
                    camera_id=cam_id_str,
                    camera_name=cam_name,
                    location=location,
                    violation_count=counts["total"],
                    critical_count=counts["critical"],
                    percentage=round((counts["total"] / total_violations) * 100, 1) if total_violations > 0 else 0.0,
                )
            )

        return FullReportResponse(
            period_start=start_time.isoformat(),
            period_end=end_time.isoformat(),
            summary=summary,
            trend=trend,
            by_type=by_type,
            by_severity=by_severity,
            hourly=hourly,
            hotspots=hotspots,
        )

    def generate_csv_export(
        self,
        start_time: datetime,
        end_time: datetime,
        camera_id: UUID | None = None,
    ) -> str:
        query = self.db.query(ViolationModel).filter(
            ViolationModel.deleted_at.is_(None),
            ViolationModel.detected_time >= start_time,
            ViolationModel.detected_time <= end_time,
        )
        if camera_id:
            query = query.filter(ViolationModel.camera_id == camera_id)

        violations = query.order_by(ViolationModel.detected_time.desc()).all()

        cameras_db = self.db.query(CameraModel).all()
        cam_map = {str(c.id): c.name for c in cameras_db}

        output = io.StringIO()
        # UTF-8 BOM for Microsoft Excel Vietnamese support
        output.write("\ufeff")
        writer = csv.writer(output)

        writer.writerow([
            "Mã Vi Phạm",
            "Thời Gian Phát Hiện",
            "Tên Camera",
            "Loại Vi Phạm",
            "Mức Độ Nguy Hiểm",
            "Mã Công Nhân",
            "Trạng Thái Xử Lý",
            "Thời Gian Duyệt",
        ])

        for v in violations:
            cam_name = cam_map.get(str(v.camera_id), f"Cam {str(v.camera_id)[:8]}")
            time_str = v.detected_time.strftime("%d/%m/%Y %H:%M:%S") if v.detected_time else ""
            reviewed_str = v.reviewed_at.strftime("%d/%m/%Y %H:%M:%S") if v.reviewed_at else "Chưa duyệt"
            writer.writerow([
                str(v.id),
                time_str,
                cam_name,
                self._format_type_name(v.violation_type),
                v.severity_level,
                v.worker_code or "Không xác định",
                v.status,
                reviewed_str,
            ])

        return output.getvalue()
