import { useState, useRef, useEffect } from 'react';
import styles from './ViolationsPage.module.css';

interface ViolationLog {
  id: string;
  time: string;
  location: string;
  type: string;
  severity: 'danger' | 'warning' | 'info';
  details: string;
}

export default function ViolationsPage() {
  const [logs] = useState<ViolationLog[]>([
    { id: 'V-001', time: '2026-07-12 09:20:15', location: 'CAM-03 • Kho hàng B', type: 'Không đội mũ bảo hộ (No Helmet)', severity: 'danger', details: 'Nhân viên bốc dỡ hàng hóa di chuyển vào lối đi xe nâng mà không mang mũ bảo hiểm.' },
    { id: 'V-002', time: '2026-07-12 09:12:04', location: 'CAM-08 • Trạm biến áp', type: 'Xâm nhập vùng cấm (Intrusion)', severity: 'danger', details: 'Phát hiện đối tượng đứng gần khu vực tủ điện trung thế ngoài khung giờ bảo trì.' },
    { id: 'V-003', time: '2026-07-12 08:45:30', location: 'CAM-04 • Xưởng đóng gói', type: 'Thiếu áo phản quang', severity: 'warning', details: 'Worker A làm ca sáng không mang áo phản quang đúng quy chuẩn an toàn.' },
    { id: 'V-004', time: '2026-07-12 07:15:22', location: 'CAM-01 • Cổng xe ra vào', type: 'Xe nâng quá tốc độ', severity: 'warning', details: 'Xe nâng di chuyển với tốc độ 18km/h, vượt quá tốc độ giới hạn 10km/h.' },
    { id: 'V-005', time: '2026-07-11 16:30:10', location: 'CAM-05 • Server Room', type: 'Lỗi cảm biến thiết bị', severity: 'info', details: 'Cảnh báo nhiệt độ phòng máy tăng lên 26 độ C. Model tự động gửi yêu cầu kiểm tra điều hòa.' }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedLog, setSelectedLog] = useState<ViolationLog | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter logs based on inputs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.location.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;
    return matchesSearch && matchesSeverity;
  });

  // Render snapshot in details modal
  useEffect(() => {
    if (!selectedLog || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw snapshot mock scene
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background camera visual mock details
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Draw worker overlay bounding box for the violation
    const boxX = selectedLog.severity === 'danger' ? 120 : 160;
    const boxY = 40;
    const boxW = 80;
    const boxH = 140;
    const color = selectedLog.severity === 'danger' ? '#ef4444' : 
                  selectedLog.severity === 'warning' ? '#fbbf24' : '#38bdf8';

    // Bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Box header
    ctx.fillStyle = color;
    ctx.fillRect(boxX, boxY - 20, boxW, 20);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Inter';
    ctx.fillText(selectedLog.severity.toUpperCase(), boxX + 6, boxY - 6);

    // Draw a small warning icon in the center of the box
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(boxX + boxW / 2, boxY + 30, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter';
    ctx.fillText('!', boxX + boxW / 2 - 3, boxY + 34);

    // Meta details on canvas
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '10px Courier New';
    ctx.fillText(`SNAPSHOT ID: ${selectedLog.id}`, 20, canvas.height - 30);
    ctx.fillText(`TIMESTAMP  : ${selectedLog.time}`, 20, canvas.height - 15);
  }, [selectedLog]);

  return (
    <div>
      {/* Top search & filter bar */}
      <div className={styles.topBar}>
        <div className={`input-group ${styles.searchField}`}>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">search</span>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Tìm kiếm theo vị trí hoặc lỗi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div>
          <select 
            className={styles.filterSelect}
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
          >
            <option value="all">Tất cả độ nghiêm trọng</option>
            <option value="danger">Danger (Cao)</option>
            <option value="warning">Warning (Trung bình)</option>
            <option value="info">Info (Thấp)</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Mã lỗi</th>
              <th className={styles.th}>Thời gian</th>
              <th className={styles.th}>Vị trí đầu ghi</th>
              <th className={styles.th}>Hành vi vi phạm</th>
              <th className={styles.th}>Độ nguy hiểm</th>
              <th className={`${styles.th} ${styles.actionsCell}`}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id} className={styles.tr}>
                <td className={`${styles.td} ${styles.violationTitle}`}>{log.id}</td>
                <td className={`${styles.td} tabular-nums`}>{log.time}</td>
                <td className={styles.td}>{log.location}</td>
                <td className={styles.td}>{log.type}</td>
                <td className={styles.td}>
                  <span className={`badge ${
                    log.severity === 'danger' ? 'badge-danger' : 
                    log.severity === 'warning' ? 'badge-warning' : 'badge-secondary'
                  }`}>
                    {log.severity === 'danger' ? 'Danger' : log.severity === 'warning' ? 'Warning' : 'Info'}
                  </span>
                </td>
                <td className={`${styles.td} ${styles.actionsCell}`}>
                  <button 
                    className="btn btn-outline"
                    style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                    onClick={() => setSelectedLog(log)}
                  >
                    Xem snapshot
                  </button>
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--on-surface-variant)' }}>
                  Không tìm thấy vi phạm an toàn nào phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Snapshot audit dialog Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{ padding: '24px', width: '450px', backgroundColor: 'var(--surface-lowest)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Chi tiết lỗi vi phạm {selectedLog.id}</h3>
              <button 
                onClick={() => setSelectedLog(null)}
                style={{ cursor: 'pointer', color: 'var(--on-surface-variant)' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {/* Snapshot Preview Box */}
            <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--outline-variant)', marginBottom: '16px' }}>
              <canvas ref={canvasRef} width={400} height={200} style={{ width: '100%', display: 'block' }} />
            </div>

            {/* Description Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <div><strong>Vị trí:</strong> {selectedLog.location}</div>
              <div><strong>Hành vi:</strong> {selectedLog.type}</div>
              <div><strong>Thời gian:</strong> {selectedLog.time}</div>
              <div style={{ marginTop: '8px', lineHeight: 1.5, color: 'var(--on-surface-variant)' }}>
                <strong>Chi tiết kiểm toán:</strong> {selectedLog.details}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                className="btn btn-primary" 
                style={{ height: '36px' }}
                onClick={() => {
                  alert(`Đã lưu biên bản kiểm toán cho lỗi ${selectedLog.id}.`);
                  setSelectedLog(null);
                }}
              >
                Xác nhận kiểm toán
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
