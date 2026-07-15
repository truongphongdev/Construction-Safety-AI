import { useState } from 'react';
import styles from './ReportsPage.module.css';

interface WeeklyStat {
  day: string;
  violations: number;
  height: string; // CSS height representation
}

export default function ReportsPage() {
  const [weeklyData] = useState<WeeklyStat[]>([
    { day: 'Thứ 2', violations: 12, height: '60%' },
    { day: 'Thứ 3', violations: 8, height: '40%' },
    { day: 'Thứ 4', violations: 15, height: '75%' },
    { day: 'Thứ 5', violations: 5, height: '25%' },
    { day: 'Thứ 6', violations: 19, height: '95%' },
    { day: 'Thứ 7', violations: 4, height: '20%' },
    { day: 'Chủ Nhật', violations: 2, height: '10%' }
  ]);

  const [metrics] = useState({
    totalIncidents: '65',
    complianceRate: '96.2%',
    falseAlarms: '1.4%',
    avgResponse: '2.5m'
  });

  const handleExport = (format: 'PDF' | 'CSV') => {
    alert(`Đang khởi tạo kết xuất báo cáo định dạng ${format}... Báo cáo tuần ${new Date().toLocaleDateString('vi-VN')} đã sẵn sàng tải xuống.`);
  };

  return (
    <div>
      {/* Analytics Metrics cards */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statHeader}>
            <span>Tổng số vụ vi phạm</span>
            <span className="material-symbols-outlined text-primary">warning</span>
          </div>
          <div className={`${styles.statValue} tabular-nums`}>{metrics.totalIncidents}</div>
          <div className={styles.statDesc} style={{ color: 'var(--color-danger)' }}>
            📈 Tăng 8% so với tuần trước
          </div>
        </div>

        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statHeader}>
            <span>Tỷ lệ tuân thủ PPE</span>
            <span className="material-symbols-outlined text-primary">check_circle</span>
          </div>
          <div className={`${styles.statValue} tabular-nums`}>{metrics.complianceRate}</div>
          <div className={styles.statDesc} style={{ color: 'var(--color-success)' }}>
            🟢 Đạt chuẩn an toàn quốc gia
          </div>
        </div>

        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statHeader}>
            <span>Tỷ lệ báo động sai</span>
            <span className="material-symbols-outlined text-primary">flaky</span>
          </div>
          <div className={`${styles.statValue} tabular-nums`}>{metrics.falseAlarms}</div>
          <div className={styles.statDesc}>
            📉 Giảm 0.5% từ v2.4.0 update
          </div>
        </div>

        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statHeader}>
            <span>T.gian phản hồi TB</span>
            <span className="material-symbols-outlined text-primary">hourglass_empty</span>
          </div>
          <div className={`${styles.statValue} tabular-nums`}>{metrics.avgResponse}</div>
          <div className={styles.statDesc}>
            ⏱️ Tốc độ xử lý khẩn cấp
          </div>
        </div>
      </div>

      {/* Weekly violations chart */}
      <div className={`${styles.chartCard} glass-panel`}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>Biểu đồ vi phạm trong tuần qua</h3>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn btn-outline" 
              style={{ height: '32px', fontSize: '12px' }}
              onClick={() => handleExport('CSV')}
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Xuất CSV
            </button>
            <button 
              className="btn btn-primary" 
              style={{ height: '32px', fontSize: '12px' }}
              onClick={() => handleExport('PDF')}
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              Xuất PDF
            </button>
          </div>
        </div>

        {/* Dynamic Pure CSS Bar Chart */}
        <div className={styles.chartContainer}>
          {weeklyData.map((data, idx) => (
            <div key={idx} className={styles.barWrapper}>
              <div 
                className={styles.bar} 
                style={{ height: data.height }}
                title={`${data.violations} vụ`}
              >
                <span className={styles.barValue}>{data.violations}</span>
              </div>
              <span className={styles.barLabel}>{data.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
