import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DashboardPage.module.css';

interface AlertLog {
  id: string;
  type: 'danger' | 'warning' | 'info';
  title: string;
  camera: string;
  time: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [metrics] = useState({
    activeCams: '12 / 12',
    activeModel: 'YOLOv8 Suite',
    activeAlerts: '6 Active',
    systemHealth: '98.5%'
  });

  const [alerts] = useState<AlertLog[]>([
    { id: '1', type: 'danger', title: 'Không đội mũ bảo hộ (No Helmet)', camera: 'Cam 03 - Kho hàng B', time: '10 giây trước' },
    { id: '2', type: 'warning', title: 'Xâm nhập vùng nguy hiểm (Intruder)', camera: 'Cam 08 - Trạm điện', time: '2 phút trước' },
    { id: '3', type: 'info', title: 'Thiết bị bảo hộ đầy đủ', camera: 'Cam 01 - Cổng chính', time: '5 phút trước' },
    { id: '4', type: 'danger', title: 'Không mặc áo phản quang', camera: 'Cam 04 - Xưởng đóng gói', time: '15 phút trước' },
    { id: '5', type: 'info', title: 'Đã cập nhật cấu hình model', camera: 'Hệ thống', time: '1 giờ trước' }
  ]);

  // Real-time canvas CCTV simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let frame = 0;

    // Simulation entities
    const workers = [
      { id: 1, x: 100, y: 150, dx: 1.2, dy: 0.5, helmet: true, name: 'Worker A' },
      { id: 2, x: 400, y: 220, dx: -0.8, dy: 1.0, helmet: false, name: 'Worker B (No Helmet)' },
      { id: 3, x: 250, y: 110, dx: 0.5, dy: -0.3, helmet: true, name: 'Worker C' }
    ];

    const render = () => {
      frame++;
      
      // Clear canvas with CCTV green-dark background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      // Draw safe warehouse zone lines
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
      ctx.setLineDash([]);

      // Draw Safe Zone text labels
      ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.font = '10px Inter';
      ctx.fillText('SAFETY ZONE LIMIT', 60, 45);

      // Update and draw workers
      workers.forEach((worker) => {
        // Move worker
        worker.x += worker.dx;
        worker.y += worker.dy;

        // Bounce off walls
        if (worker.x < 80 || worker.x > canvas.width - 120) worker.dx *= -1;
        if (worker.y < 80 || worker.y > canvas.height - 120) worker.dy *= -1;

        // Draw worker box
        const boxWidth = 60;
        const boxHeight = 120;
        const color = worker.helmet ? '#16a34a' : '#ef4444'; // Green if safe, Red if violation

        // Drawing bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(worker.x, worker.y, boxWidth, boxHeight);

        // Drawing translucent overlay
        ctx.fillStyle = worker.helmet ? 'rgba(22, 163, 74, 0.05)' : 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(worker.x, worker.y, boxWidth, boxHeight);

        // Draw bounding box title label background
        ctx.fillStyle = color;
        ctx.fillRect(worker.x, worker.y - 20, boxWidth, 20);

        // Draw text info inside box title
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Inter';
        ctx.fillText(worker.helmet ? 'SAFE: 98%' : 'ALERT: 99%', worker.x + 4, worker.y - 6);

        // Draw Helmet overlay icon on worker head
        ctx.fillStyle = worker.helmet ? '#16a34a' : '#ef4444';
        ctx.beginPath();
        ctx.arc(worker.x + boxWidth / 2, worker.y + 15, 8, 0, Math.PI * 2);
        ctx.fill();

        // Draw worker text description underneath
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px Inter';
        ctx.fillText(worker.name, worker.x, worker.y + boxHeight + 14);
      });

      // Draw flashing alert bar if there is a violation
      const hasViolation = workers.some(w => !w.helmet);
      if (hasViolation && Math.floor(frame / 20) % 2 === 0) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px Inter';
        ctx.fillText('🔴 VIOLATION DETECTED: PPE COMPLIANCE FAILURE', 20, canvas.height - 20);
      }

      // Draw camera overlay details
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Courier New';
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      ctx.fillText(`REC LIVE  ${timestamp}  CAM 03`, 20, 30);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div>
      {/* Metrics Row */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricIconWrapper} style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <span className="material-symbols-outlined">videocam</span>
          </div>
          <div>
            <div className={styles.metricTitle}>Active Cameras</div>
            <div className={`${styles.metricValue} tabular-nums`}>{metrics.activeCams}</div>
          </div>
        </div>

        <div className={`${styles.metricCard} glass-panel`} style={{ cursor: 'pointer' }} onClick={() => navigate('/models')}>
          <div className={styles.metricIconWrapper} style={{ backgroundColor: 'var(--primary-container)', color: 'var(--on-primary)' }}>
            <span className="material-symbols-outlined icon-filled">psychology</span>
          </div>
          <div>
            <div className={styles.metricTitle}>Connected Model</div>
            <div className={styles.metricValue}>{metrics.activeModel}</div>
          </div>
        </div>

        <div className={`${styles.metricCard} glass-panel`} style={{ cursor: 'pointer' }} onClick={() => navigate('/violations')}>
          <div className={styles.metricIconWrapper} style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <div className={styles.metricTitle}>Violations</div>
            <div className={styles.metricValue}>{metrics.activeAlerts}</div>
          </div>
        </div>

        <div className={`${styles.metricCard} glass-panel`}>
          <div className={styles.metricIconWrapper} style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            <span className="material-symbols-outlined">analytics</span>
          </div>
          <div>
            <div className={styles.metricTitle}>System Health</div>
            <div className={`${styles.metricValue} tabular-nums`}>{metrics.systemHealth}</div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className={styles.mainGrid}>
        {/* Live CCTV Video Monitor */}
        <div className={`${styles.feedCard} glass-panel`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <span className={styles.statusDot}></span>
              Live Feed Simulation (Kho Hàng B)
            </div>
            <button className="btn btn-outline" style={{ height: '32px', fontSize: '12px' }} onClick={() => navigate('/cameras')}>
              Xem tất cả camera
            </button>
          </div>
          <div className={styles.canvasContainer}>
            <div className={styles.feedInfo}>CAM-03: NORTH WAREHOUSE</div>
            <div className={styles.feedOverlay}>AI MODEL: YOLOv8_SAFETY_SUITE</div>
            <canvas 
              ref={canvasRef} 
              width={640} 
              height={360} 
              className={styles.videoCanvas}
            />
          </div>
        </div>

        {/* Recent Violations Panel */}
        <div className={`${styles.alertsCard} glass-panel`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <span className="material-symbols-outlined text-primary">notifications_active</span>
              Recent Violations
            </div>
          </div>
          <ul className={styles.alertsList}>
            {alerts.map((alert) => (
              <li 
                key={alert.id} 
                className={styles.alertItem}
                style={{ 
                  borderLeftColor: 
                    alert.type === 'danger' ? 'var(--error)' : 
                    alert.type === 'warning' ? 'var(--color-warning)' : 'var(--primary)' 
                }}
              >
                <div className={styles.alertContent}>
                  <div className={styles.alertHeading}>{alert.title}</div>
                  <div className={styles.alertMeta}>
                    <span>{alert.camera}</span>
                    <span className="tabular-nums">{alert.time}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
