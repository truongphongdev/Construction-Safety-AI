from datetime import datetime, time, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Query, Response, status
from fastapi.responses import PlainTextResponse

from app.dependencies import DbDep
from app.schemas.reports import FullReportResponse, ReportSummary
from app.services.report_service import ReportService

router = APIRouter()


def _parse_time_range(
    range_type: str | None,
    start_date: str | None,
    end_date: str | None,
) -> tuple[datetime, datetime]:
    now = datetime.now()
    today_start = datetime.combine(now.date(), time.min)
    today_end = datetime.combine(now.date(), time.max)

    if range_type == "today":
        return today_start, today_end
    elif range_type == "30days":
        return today_start - timedelta(days=29), today_end
    elif range_type == "month":
        month_start = datetime(now.year, now.month, 1, 0, 0, 0)
        return month_start, today_end
    elif range_type == "custom" and start_date and end_date:
        try:
            s_dt = datetime.fromisoformat(start_date)
            e_dt = datetime.fromisoformat(end_date)
            # If time is 00:00:00, set end time to end of day
            if e_dt.time() == time.min:
                e_dt = datetime.combine(e_dt.date(), time.max)
            return s_dt, e_dt
        except Exception:
            pass

    # Default to 7 days
    return today_start - timedelta(days=6), today_end


@router.get(
    "",
    response_model=FullReportResponse,
    summary="Lấy toàn bộ dữ liệu báo cáo & thống kê an toàn",
)
@router.get(
    "/",
    response_model=FullReportResponse,
    include_in_schema=False,
)
def get_full_report(
    db: DbDep,
    range: str | None = Query("7days", description="Khoảng thời gian: today, 7days, 30days, month, custom"),
    start_date: str | None = Query(None, description="Ngày bắt đầu (ISO/YYYY-MM-DD) khi range=custom"),
    end_date: str | None = Query(None, description="Ngày kết thúc (ISO/YYYY-MM-DD) khi range=custom"),
    camera_id: UUID | None = Query(None, description="Lọc theo Camera ID"),
):
    start_time, end_time = _parse_time_range(range, start_date, end_date)
    service = ReportService(db)
    return service.get_full_report(start_time, end_time, camera_id)


@router.get(
    "/summary",
    response_model=ReportSummary,
    summary="Lấy tóm tắt chỉ số KPI an toàn",
)
def get_report_summary(
    db: DbDep,
    range: str | None = Query("7days"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    camera_id: UUID | None = Query(None),
):
    start_time, end_time = _parse_time_range(range, start_date, end_date)
    service = ReportService(db)
    full_report = service.get_full_report(start_time, end_time, camera_id)
    return full_report.summary


@router.get(
    "/export/csv",
    summary="Xuất báo cáo vi phạm dạng file CSV",
)
def export_csv(
    db: DbDep,
    range: str | None = Query("7days"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    camera_id: UUID | None = Query(None),
):
    start_time, end_time = _parse_time_range(range, start_date, end_date)
    service = ReportService(db)
    csv_content = service.generate_csv_export(start_time, end_time, camera_id)

    filename = f"bao_cao_vi_pham_{start_time.strftime('%Y%m%d')}_{end_time.strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
        },
    )
