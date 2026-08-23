import { useState, useEffect, useCallback } from 'react';
import styles from './ReportsPage.module.css';
import {
  fetchFullReport,
  fetchCameras,
  getReportCsvDownloadUrl,
  type FullReportResponse,
  type Camera,
  type ReportFilterParams,
} from '../../services/api';

export default function ReportsPage() {
  const [range, setRange] = useState<string>('7days');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedCameraId, setSelectedCameraId] = useState<string>('all');
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [report, setReport] = useState<FullReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load cameras for filter dropdown
  useEffect(() => {
    fetchCameras().then((data) => setCameras(data)).catch(() => {});
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: ReportFilterParams = {
        range,
        camera_id: selectedCameraId === 'all' ? undefined : selectedCameraId,
      };
      if (range === 'custom') {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      const data = await fetchFullReport(params);
      setReport(data);
    } catch (err: unknown) {
      console.error('Lỗi khi tải báo cáo thống kê:', err);
      setError(err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ báo cáo');
    } finally {
      setLoading(false);
    }
  }, [range, startDate, endDate, selectedCameraId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExportCSV = () => {
    const params: ReportFilterParams = {
      range,
      camera_id: selectedCameraId === 'all' ? undefined : selectedCameraId,
    };
    if (range === 'custom') {
      params.start_date = startDate;
      params.end_date = endDate;
    }
    const url = getReportCsvDownloadUrl(params);
    window.open(url, '_blank');
  };

  const handleExportPDF = () => {
    window.print();
  };

  // Find max violations in trend for chart scaling
  const maxTrendViolations = Math.max(
    ...(report?.trend.map((t) => t.violations) || [1]),
    1
  );

  return (
    <div className={styles.reportsContainer}>
      {/* ── 1. Filter and Action Toolbar ────────────────────────────────────── */}
      <div className={`${styles.filterBar} glass-panel`}>
        <div className={styles.filterControls}>
          {/* Quick Range Group */}
          <div className={styles.rangeButtonGroup}>
            <button
              className={`${styles.rangeBtn} ${range === '7days' ? styles.rangeBtnActive : ''}`}
              onClick={() => setRange('7days')}
            >
              7 ngày qua
            </button>
            <button
              className={`${styles.rangeBtn} ${range === 'today' ? styles.rangeBtnActive : ''}`}
              onClick={() => setRange('today')}
            >
              Hôm nay
            </button>
            <button
              className={`${styles.rangeBtn} ${range === '30days' ? styles.rangeBtnActive : ''}`}
              onClick={() => setRange('30days')}
            >
              30 ngày qua
            </button>
            <button
              className={`${styles.rangeBtn} ${range === 'month' ? styles.rangeBtnActive : ''}`}
              onClick={() => setRange('month')}
            >
              Tháng này
            </button>
            <button
              className={`${styles.rangeBtn} ${range === 'custom' ? styles.rangeBtnActive : ''}`}
              onClick={() => setRange('custom')}
            >
              Tùy chọn
            </button>
          </div>

          {/* Custom Date Inputs */}
          {range === 'custom' && (
            <div className={styles.customDateInputs}>
              <input
                type="date"
                className={styles.dateInput}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span>—</span>
              <input
                type="date"
                className={styles.dateInput}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <button
                className="btn btn-outline"
                style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                onClick={loadReport}
              >
                Áp dụng
              </button>
            </div>
          )}

          {/* Camera Selector */}
          <select
            className={styles.cameraSelect}
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
          >
            <option value="all">📍 Tất cả Camera & Vị trí</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                📷 {c.name} {c.location_desc ? `(${c.location_desc})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Action buttons */}
        <div className={styles.actionButtons}>
          <button
            className="btn btn-outline"
            style={{ height: '36px', fontSize: '13px' }}
            onClick={loadReport}
            title="Làm mới dữ liệu"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? styles.spin : ''}`}>
              refresh
            </span>
            Làm mới
          </button>
          <button
            className="btn btn-outline"
            style={{ height: '36px', fontSize: '13px' }}
            onClick={handleExportCSV}
            title="Xuất file CSV chuẩn UTF-8 tiếng Việt"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất CSV
          </button>
          <button
            className="btn btn-primary"
            style={{ height: '36px', fontSize: '13px' }}
            onClick={handleExportPDF}
            title="In hoặc lưu file PDF báo cáo an toàn"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Xuất PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ padding: '12px 16px' }}>
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── 2. KPI Summary Cards ────────────────────────────────────────────── */}
      <div className={styles.statsGrid}>
        {/* Total Violations */}
        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statHeader}>
            <span>Tổng số vụ vi phạm</span>
            <span className={`material-symbols-outlined text-primary ${styles.statIcon}`}>
              warning
            </span>
          </div>
          <div className={`${styles.statValue} tabular-nums`}>
            {report ? report.summary.total_violations : '—'}
          </div>
          <div className={styles.statDesc}>
            {report && report.summary.trend_percentage !== 0 ? (
              <span className={report.summary.trend_percentage > 0 ? styles.badgeDanger : styles.badgeSuccess}>
                {report.summary.trend_percentage > 0 ? '📈' : '📉'}{' '}
                {Math.abs(report.summary.trend_percentage)}% so với kỳ trước
              </span>
            ) : (
              <span>Ổn định so với kỳ trước</span>
            )}
          </div>
        </div>

        {/* PPE Compliance Rate */}
        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statHeader}>
            <span>Tỷ lệ tuân thủ PPE</span>
            <span className={`material-symbols-outlined ${styles.statIcon}`} style={{ color: 'var(--color-success)' }}>
              check_circle
            </span>
          </div>
          <div className={`${styles.statValue} tabular-nums`}>
            {report ? `${report.summary.compliance_rate}%` : '—'}
          </div>
          <div className={styles.statDesc}>
            <span className={styles.badgeSuccess}>
              🟢 Đạt chuẩn an toàn công trường
            </span>
          </div>
        </div>

        {/* False Alarm Rate */}
        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statHeader}>
            <span>Tỷ lệ báo động sai</span>
            <span className={`material-symbols-outlined text-primary ${styles.statIcon}`}>
              flaky
            </span>
          </div>
          <div className={`${styles.statValue} tabular-nums`}>
            {report ? `${report.summary.false_alarm_rate}%` : '0%'}
          </div>
          <div className={styles.statDesc}>
            <span>📉 {report?.summary.false_alarm_count || 0} vụ báo động sai</span>
          </div>
        </div>

        {/* Avg Response Time */}
        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statHeader}>
            <span>T.gian phản hồi TB</span>
            <span className={`material-symbols-outlined text-primary ${styles.statIcon}`}>
              hourglass_empty
            </span>
          </div>
          <div className={`${styles.statValue} tabular-nums`}>
            {report ? `${report.summary.avg_response_minutes}m` : '2.5m'}
          </div>
          <div className={styles.statDesc}>
            <span>⏱️ Tốc độ xử lý cảnh báo</span>
          </div>
        </div>
      </div>

      {/* ── 3. Status Breakdown Bar ────────────────────────────────────────── */}
      {report && (
        <div className={`${styles.statusBar} glass-panel`}>
          <div className={styles.statusItem}>
            <div className={styles.statusDot} style={{ background: 'var(--color-warning)' }} />
            <span>Chờ duyệt:</span>
            <span className={styles.statusCount}>{report.summary.pending_count}</span>
          </div>
          <div className={styles.statusItem}>
            <div className={styles.statusDot} style={{ background: 'var(--color-success)' }} />
            <span>Đã xác nhận:</span>
            <span className={styles.statusCount}>{report.summary.confirmed_count}</span>
          </div>
          <div className={styles.statusItem}>
            <div className={styles.statusDot} style={{ background: 'var(--primary)' }} />
            <span>Đã gửi cảnh báo:</span>
            <span className={styles.statusCount}>{report.summary.warning_sent_count}</span>
          </div>
          <div className={styles.statusItem}>
            <div className={styles.statusDot} style={{ background: 'var(--on-surface-variant)' }} />
            <span>Báo động sai:</span>
            <span className={styles.statusCount}>{report.summary.false_alarm_count}</span>
          </div>
        </div>
      )}

      {/* ── 4. Main Trend Chart ────────────────────────────────────────────── */}
      <div className={`${styles.chartCard} glass-panel`}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleGroup}>
            <h3 className={styles.chartTitle}>
              <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
              Biểu đồ xu hướng vi phạm theo thời gian
            </h3>
            <span className={styles.chartSubtitle}>
              Phân bố số lượng vi phạm và mức độ rủi ro theo từng ngày
            </span>
          </div>

          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <div className={styles.legendColor} style={{ background: 'var(--color-danger)' }} />
              <span>Nguy hiểm cao</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendColor} style={{ background: 'var(--color-warning)' }} />
              <span>Vừa phải</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendColor} style={{ background: 'var(--primary-container)' }} />
              <span>Nhẹ</span>
            </div>
          </div>
        </div>

        {/* Dynamic CSS Bar Chart with Stacked Severity */}
        {report && report.trend.length > 0 ? (
          <div className={styles.chartContainer}>
            <div className={styles.chartGridLines}>
              <div className={styles.gridLine} />
              <div className={styles.gridLine} />
              <div className={styles.gridLine} />
            </div>

            {report.trend.map((data, idx) => {
              const total = data.violations;
              const heightPercent = total > 0 ? Math.max(12, (total / maxTrendViolations) * 90) : 4;
              const critRatio = total > 0 ? (data.critical_count / total) * 100 : 0;
              const medRatio = total > 0 ? (data.medium_count / total) * 100 : 0;
              const lowRatio = total > 0 ? (data.low_count / total) * 100 : 0;

              return (
                <div key={idx} className={styles.barWrapper}>
                  <span className={styles.barValue}>{total > 0 ? total : ''}</span>
                  <div
                    className={styles.barStack}
                    style={{ height: `${heightPercent}%` }}
                    title={`${data.label}: ${total} vụ (${data.critical_count} cao, ${data.medium_count} vừa, ${data.low_count} nhẹ)`}
                  >
                    {critRatio > 0 && (
                      <div className={styles.barSegmentCritical} style={{ height: `${critRatio}%` }} />
                    )}
                    {medRatio > 0 && (
                      <div className={styles.barSegmentMedium} style={{ height: `${medRatio}%` }} />
                    )}
                    {lowRatio > 0 && (
                      <div className={styles.barSegmentLow} style={{ height: `${lowRatio}%` }} />
                    )}
                    {total === 0 && (
                      <div style={{ height: '100%', background: 'var(--surface-container)' }} />
                    )}
                  </div>
                  <span className={styles.barLabel}>{data.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.loadingBox}>
            <span className="material-symbols-outlined text-[32px]">analytics</span>
            <span>Chưa có dữ liệu vi phạm trong khoảng thời gian đã chọn</span>
          </div>
        )}
      </div>

      {/* ── 5. Breakdown Insights (2 Columns) ──────────────────────────────── */}
      <div className={styles.twoColGrid}>
        {/* Left: Violation Types Breakdown */}
        <div className={`${styles.chartCard} glass-panel`}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleGroup}>
              <h3 className={styles.chartTitle}>
                <span className="material-symbols-outlined text-primary text-[20px]">category</span>
                Phân bố theo Loại vi phạm
              </h3>
              <span className={styles.chartSubtitle}>
                Tỷ trọng từng loại lỗi không tuân thủ an toàn
              </span>
            </div>
          </div>

          <div className={styles.progressList}>
            {report && report.by_type.length > 0 ? (
              report.by_type.map((item, idx) => {
                const colors = [
                  'var(--primary)',
                  'var(--color-warning)',
                  'var(--color-danger)',
                  '#8b5cf6',
                  '#ec4899',
                  '#06b6d4',
                ];
                const color = colors[idx % colors.length];
                return (
                  <div key={item.type_code} className={styles.progressItem}>
                    <div className={styles.progressItemHeader}>
                      <span className={styles.progressItemLabel}>{item.type_name}</span>
                      <span className={styles.progressItemValue}>
                        {item.count} vụ ({item.percentage}%)
                      </span>
                    </div>
                    <div className={styles.progressBarTrack}>
                      <div
                        className={styles.progressBarFill}
                        style={{ width: `${item.percentage}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.loadingBox}>
                <span>Không có dữ liệu phân loại</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Severity & Peak Hourly Heat */}
        <div className={`${styles.chartCard} glass-panel`}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleGroup}>
              <h3 className={styles.chartTitle}>
                <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
                Khung giờ nguy cơ cao trong ngày
              </h3>
              <span className={styles.chartSubtitle}>
                Mật độ số vụ vi phạm theo các khung giờ (00:00 - 23:00)
              </span>
            </div>
          </div>

          <div className={styles.hourlyGrid}>
            {report &&
              report.hourly.map((h) => {
                const isPeak = h.count > 10;
                return (
                  <div
                    key={h.hour}
                    className={`${styles.hourlyCell} ${isPeak ? styles.hourlyCellPeak : ''}`}
                    title={`Khung giờ ${h.label}: ${h.count} vụ vi phạm`}
                  >
                    <span>{h.label}</span>
                    <span className={styles.hourlyCellCount}>{h.count}</span>
                  </div>
                );
              })}
          </div>

          {/* Severity summary below hourly */}
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--on-surface)' }}>
              Phân loại theo Mức độ rủi ro
            </h4>
            <div className={styles.progressList}>
              {report?.by_severity.map((sev) => {
                const color =
                  sev.severity === 'CRITICAL'
                    ? 'var(--color-danger)'
                    : sev.severity === 'MEDIUM'
                    ? 'var(--color-warning)'
                    : 'var(--primary)';
                return (
                  <div key={sev.severity} className={styles.progressItem}>
                    <div className={styles.progressItemHeader}>
                      <span className={styles.progressItemLabel}>{sev.label}</span>
                      <span className={styles.progressItemValue}>
                        {sev.count} vụ ({sev.percentage}%)
                      </span>
                    </div>
                    <div className={styles.progressBarTrack}>
                      <div
                        className={styles.progressBarFill}
                        style={{ width: `${sev.percentage}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. Camera Hotspots Table ───────────────────────────────────────── */}
      <div className={`${styles.chartCard} glass-panel`}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleGroup}>
            <h3 className={styles.chartTitle}>
              <span className="material-symbols-outlined text-primary text-[20px]">videocam</span>
              Bảng xếp hạng Điểm nóng Vi phạm theo Vị trí & Camera
            </h3>
            <span className={styles.chartSubtitle}>
              Khu vực cần tăng cường kiểm tra và nhắc nhở an toàn lao động
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className={styles.hotspotTable}>
            <thead>
              <tr>
                <th>TÊN CAMERA</th>
                <th>VỊ TRÍ / KHU VỰC</th>
                <th>TỔNG SỐ VỤ</th>
                <th>MỨC ĐỘ NGUY HIỂM</th>
                <th>TỶ TRỌNG (%)</th>
              </tr>
            </thead>
            <tbody>
              {report && report.hotspots.length > 0 ? (
                report.hotspots.map((cam) => (
                  <tr key={cam.camera_id}>
                    <td style={{ fontWeight: 600 }}>{cam.camera_name}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{cam.location}</td>
                    <td className="tabular-nums" style={{ fontWeight: 700 }}>
                      {cam.violation_count}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: cam.critical_count > 0 ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                          color: cam.critical_count > 0 ? 'var(--color-danger)' : 'var(--color-success)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {cam.critical_count > 0 ? `${cam.critical_count} vụ nghiêm trọng` : 'Bình thường'}
                      </span>
                    </td>
                    <td style={{ width: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className={styles.progressBarTrack} style={{ flex: 1 }}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${cam.percentage}%`,
                              background: 'var(--primary)',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>{cam.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--on-surface-variant)' }}>
                    Không có vi phạm ghi nhận theo camera trong khoảng thời gian này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
