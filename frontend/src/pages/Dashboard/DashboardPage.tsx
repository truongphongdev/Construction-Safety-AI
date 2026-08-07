import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DashboardPage.module.css';
import { fetchViolations, fetchCameras, checkHealth } from '../../services';
import type { Violation } from '../../services';
import { mapViolationType } from '@/utils/translation';
import { useWebcam } from '@/contexts/WebcamContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isWebcamActive, webcamFrame, startWebcam, stopWebcam } = useWebcam();

  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [selectedViolationImage, setSelectedViolationImage] = useState<string | null>(null);

  const [metrics, setMetrics] = useState({
    activeCams: '—',
    activeModel: 'YOLOv8 best.pt (PPE 5-class)',
    activeAlerts: '0',
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

      // Xác định trạng thái hệ thống
      let systemStatus = 'Backend chưa kết nối';
      if (healthy) {
        systemStatus = 'Online — Backend Active';
      }

      setMetrics(m => ({
        ...m,
        systemHealth: systemStatus,
        activeCams: healthy ? `${apiCams.length}` : '—',
      }));

      const vios = await fetchViolations(camMap);
      if (mounted) {
        setRecentViolations(vios);
        setMetrics(m => ({ ...m, activeAlerts: String(vios.length) }));

        // Kích hoạt chuông 🔔 & Toast notification nếu phát hiện vi phạm mới
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
    <div>
      {/* ── Metrics Row ─────────────────────────────────────────────────── */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricIconWrapper} style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <span className="material-symbols-outlined">videocam</span>
          </div>
          <div>
            <div className={styles.metricTitle}>Camera hoạt động</div>
            <div className={`${styles.metricValue} tabular-nums`}>{metrics.activeCams}</div>
          </div>
        </div>

        <div className={`${styles.metricCard} glass-panel`} style={{ cursor: 'pointer' }} onClick={() => navigate('/violations')}>
          <div className={styles.metricIconWrapper} style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <div className={styles.metricTitle}>Vi phạm ghi nhận</div>
            <div className={styles.metricValue} style={{ color: Number(metrics.activeAlerts) > 0 ? 'var(--error)' : undefined }}>
              {metrics.activeAlerts}
            </div>
          </div>
        </div>

        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricIconWrapper} style={{
            background: isBackendConnected ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
            color: isBackendConnected ? 'var(--color-success)' : 'var(--color-warning)'
          }}>
            <span className="material-symbols-outlined">cloud_sync</span>
          </div>
          <div>
            <div className={styles.metricTitle}>Hệ thống Backend</div>
            <div className={styles.metricValue} style={{ fontSize: '13px', color: isBackendConnected ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {metrics.systemHealth}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Grid: Violations Table + Test AI ───────────────────────── */}
      <div className={styles.mainGrid}>
        
        {/* Left Side: Recent Violations (2fr) */}
        <div className={`${styles.alertsCard} glass-panel`} style={{ padding: '24px' }}>
          <div className={styles.cardHeader} style={{ marginBottom: '20px' }}>
            <div className={styles.cardTitle} style={{ fontSize: '18px', gap: '10px' }}>
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>notifications_active</span>
              Nhật ký vi phạm gần đây
            </div>
            <button
              className="btn btn-outline"
              style={{ height: '32px', fontSize: '13px' }}
              onClick={() => navigate('/violations')}
            >
              Xem tất cả vi phạm
            </button>
          </div>

          {recentViolations.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Hình ảnh</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Loại vi phạm</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Camera</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Thời gian</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Mức độ</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {recentViolations.slice(0, 6).map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 8px' }}>
                        {v.image_url ? (
                          <img 
                            src={v.image_url.startsWith('http') ? v.image_url : `${API_BASE.replace('/api/v1', '')}${v.image_url}`} 
                            alt={v.type}
                            style={{ width: '56px', height: '32px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
                            onClick={() => setSelectedViolationImage(v.image_url?.startsWith('http') ? v.image_url : `${API_BASE.replace('/api/v1', '')}${v.image_url}`)}
                            title="Bấm để phóng to"
                          />
                        ) : (
                          <div style={{ width: '56px', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', opacity: 0.3 }}>image</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--on-surface)' }}>
                        {mapViolationType(v.type)}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--primary)' }}>videocam</span>
                          {v.camera_id}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }} className="tabular-nums">
                        {v.timestamp}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          background: v.severity === 'danger' ? 'rgba(239,68,68,0.15)' : v.severity === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                          color: v.severity === 'danger' ? '#f87171' : v.severity === 'warning' ? '#fbbf24' : '#60a5fa'
                        }}>
                          {v.severity === 'danger' ? 'Nguy hiểm' : v.severity === 'warning' ? 'Cảnh báo' : 'Thông tin'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          background: v.status === 'RESOLVED' ? 'rgba(22,163,74,0.15)' : 'rgba(245,158,11,0.15)',
                          color: v.status === 'RESOLVED' ? '#4ade80' : '#fbbf24'
                        }}>
                          {v.status === 'RESOLVED' ? 'Đã xử lý' : 'Đang xử lý'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>verified</span>
              <div>Chưa phát hiện vi phạm an toàn lao động nào</div>
            </div>
          )}
        </div>

        {/* Right Side: Webcam AI Live panel (1fr) */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: 'var(--on-surface)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>videocam</span>
            Webcam AI Live
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Luồng trực tiếp từ webcam, nhận diện bảo hộ lao động qua YOLOv8.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <div>
              <button 
                className="btn btn-primary" 
                onClick={isWebcamActive ? stopWebcam : startWebcam}
                style={{ 
                  padding: '8px 16px', fontSize: '13px', width: '100%',
                  background: isWebcamActive ? 'var(--error)' : 'var(--primary)',
                }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '6px', verticalAlign: 'middle' }}>
                  {isWebcamActive ? 'videocam_off' : 'videocam'}
                </span>
                {isWebcamActive ? 'Tắt Webcam' : 'Bật Webcam'}
              </button>
            </div>

            {/* Preview image */}
            <div style={{
              position: 'relative', background: 'var(--surface-low)', borderRadius: '8px',
              minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              border: '1px solid var(--outline-variant)', flex: 1
            }}>
              {isWebcamActive ? (
                <>
                  {webcamFrame ? (
                    <img src={webcamFrame} alt="Webcam Live" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  ) : (
                    <div style={{ color: 'var(--on-surface-variant)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '32px', display: 'block', marginBottom: '6px', opacity: 0.3, animation: 'pulse 1.5s infinite' }}>memory</span>
                      Đang khởi tạo AI & Webcam...
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: '8px', left: '8px',
                    background: 'rgba(34,197,94,0.85)', backdropFilter: 'blur(4px)',
                    borderRadius: '6px', padding: '4px 10px',
                    fontSize: '11px', fontWeight: 600, color: '#fff', zIndex: 3,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
                    WEBCAM AI LIVE
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--on-surface-variant)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', display: 'block', marginBottom: '6px', opacity: 0.3 }}>videocam_off</span>
                  Webcam đang tắt
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full Image Viewer Modal ─────────────────────────────────────── */}
      {selectedViolationImage && (
        <div 
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={() => setSelectedViolationImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={e => e.stopPropagation()}>
            <img 
              src={selectedViolationImage} 
              alt="Violation Log Full Details" 
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} 
            />
            <button 
              style={{
                position: 'absolute', top: '-40px', right: '0', background: 'transparent', border: 'none',
                color: '#fff', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
              }}
              onClick={() => setSelectedViolationImage(null)}
            >
              <span className="material-symbols-outlined">close</span>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Đóng</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
