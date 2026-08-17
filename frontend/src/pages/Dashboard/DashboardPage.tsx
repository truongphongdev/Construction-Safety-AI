import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DashboardPage.module.css';
import { fetchViolations, fetchCameras, checkHealth } from '../../services';
import type { Violation } from '../../services';
import { mapViolationType } from '@/utils/translation';

export default function DashboardPage() {
  const navigate = useNavigate();

  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  const [metrics, setMetrics] = useState({
    activeCams: '1',
    activeModel: 'YOLOv8 best.pt (PPE 5-class)',
    activeAlerts: '0',
    todayAlerts: '0',
    systemHealth: 'Đang kiểm tra...'
  });

  const [recentViolations, setRecentViolations] = useState<Violation[]>([]);

  // Poll backend health + violations every 10s
  useEffect(() => {
    let mounted = true;
    let lastSeenViolationId = '';

    const poll = async () => {
      const healthy = await checkHealth();
      if (!mounted) return;
      setIsBackendConnected(healthy);

      const apiCams = await fetchCameras();
      const camMap: Record<string, string> = {};
      apiCams.forEach(c => {
        if (c.id && c.name) camMap[c.id] = c.name;
      });

      // Trạng thái hệ thống
      const systemStatus = healthy ? 'Hoạt động bình thường' : 'Mất kết nối Backend';

      const vios = await fetchViolations(camMap);
      if (mounted) {
        setRecentViolations(vios);

        // Tính vi phạm hôm nay
        const todayStr = new Date().toLocaleDateString('vi-VN');
        const todayCount = vios.filter(v => v.timestamp.includes(todayStr)).length;

        setMetrics({
          systemHealth: systemStatus,
          activeCams: healthy ? `${Math.max(apiCams.length, 1)}` : '0',
          activeModel: 'YOLOv8 (PPE Detection)',
          activeAlerts: String(vios.length),
          todayAlerts: String(todayCount)
        });

        // Kích hoạt chuông 🔔 nếu phát hiện vi phạm mới
        if (vios.length > 0 && vios[0].id !== lastSeenViolationId) {
          const newest = vios[0];
          if (lastSeenViolationId !== '') {
            window.dispatchEvent(new CustomEvent('violation-detected', {
              detail: {
                id: newest.id,
                camera_id: newest.camera_id,
                type: newest.type,
                confidence: 0.92,
                timestamp: newest.timestamp
              }
            }));
          }
          lastSeenViolationId = newest.id;
        }
      }
    };

    poll();
    const timer = setInterval(poll, 10_000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  return (
    <div className={styles.dashboardContainer}>
      {/* ── Welcome Banner ─────────────────────────────────────────────────── */}
      <div className={`${styles.bannerCard} glass-panel`}>
        <div className={styles.bannerInfo}>
          <h2>Trung tâm Giám sát An toàn Công trường AI</h2>
          <p>Hệ thống tự động phát hiện vi phạm đồ bảo hộ lao động qua camera thời gian thực.</p>
        </div>
        <div className={styles.bannerActions}>
          <button 
            className="btn btn-outline" 
            onClick={() => navigate('/cameras')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>videocam</span>
            Camera Giám sát
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate('/violations')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>history</span>
            Nhật ký Vi phạm
          </button>
        </div>
      </div>

      {/* ── KPI Metrics Grid ──────────────────────────────────────────────── */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricIconWrapper} style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
            <span className="material-symbols-outlined">videocam</span>
          </div>
          <div>
            <div className={styles.metricTitle}>Camera hoạt động</div>
            <div className={`${styles.metricValue} tabular-nums`}>{metrics.activeCams}</div>
          </div>
        </div>

        <div className={`${styles.metricCard} glass-panel`} style={{ cursor: 'pointer' }} onClick={() => navigate('/violations')}>
          <div className={styles.metricIconWrapper} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <div className={styles.metricTitle}>Tổng số vi phạm</div>
            <div className={styles.metricValue} style={{ color: Number(metrics.activeAlerts) > 0 ? '#ef4444' : undefined }}>
              {metrics.activeAlerts}
            </div>
          </div>
        </div>

        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricIconWrapper} style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <span className="material-symbols-outlined">pending_actions</span>
          </div>
          <div>
            <div className={styles.metricTitle}>Mô hình AI</div>
            <div className={styles.metricValue} style={{ fontSize: '14px', fontWeight: 600 }}>
              {metrics.activeModel}
            </div>
          </div>
        </div>

        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricIconWrapper} style={{
            background: isBackendConnected ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: isBackendConnected ? '#22c55e' : '#ef4444'
          }}>
            <span className="material-symbols-outlined">shield</span>
          </div>
          <div>
            <div className={styles.metricTitle}>Trạng thái Hệ thống</div>
            <div className={styles.metricValue} style={{ fontSize: '13px', color: isBackendConnected ? '#22c55e' : '#ef4444' }}>
              {metrics.systemHealth}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Violations Log Table ─────────────────────────────────────── */}
      <div className={`${styles.mainCard} glass-panel`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>notifications_active</span>
            Nhật ký vi phạm an toàn gần đây
          </div>

          <button
            className="btn btn-outline"
            style={{ height: '34px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => navigate('/violations')}
          >
            <span>Xem tất cả ({recentViolations.length})</span>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
          </button>
        </div>

        {recentViolations.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.violationsTable}>
              <thead>
                <tr>
                  <th>Loại vi phạm</th>
                  <th>Camera phát hiện</th>
                  <th>Thời gian ghi nhận</th>
                  <th>Mức độ</th>
                </tr>
              </thead>
              <tbody>
                {recentViolations.slice(0, 10).map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, color: 'var(--on-surface)' }}>
                      {mapViolationType(v.type)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>videocam</span>
                        {v.camera_id}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }} className="tabular-nums">
                      {v.timestamp}
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: v.severity === 'danger' ? 'rgba(239,68,68,0.15)' : v.severity === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                        color: v.severity === 'danger' ? '#f87171' : v.severity === 'warning' ? '#fbbf24' : '#60a5fa'
                      }}>
                        {v.severity === 'danger' ? 'Nguy hiểm' : v.severity === 'warning' ? 'Cảnh báo' : 'Thông tin'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ display: 'block' }}>verified</span>
            <div>Chưa có bản ghi vi phạm nào gần đây</div>
          </div>
        )}
      </div>
    </div>
  );
}
