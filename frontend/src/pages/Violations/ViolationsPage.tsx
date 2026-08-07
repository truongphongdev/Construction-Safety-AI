import { useState, useEffect } from 'react';
import styles from './ViolationsPage.module.css';
import { fetchViolations, fetchCameras } from '../../services';
import type { Violation } from '../../services';
import { mapViolationType } from '@/utils/translation';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function ViolationsPage() {
  const [logs, setLogs] = useState<Violation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedLog, setSelectedLog] = useState<Violation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadViolations = async () => {
      try {
        const apiCams = await fetchCameras();
        const camMap: Record<string, string> = {};
        apiCams.forEach(c => {
          if (c.id && c.name) camMap[c.id] = c.name;
        });

        const data = await fetchViolations(camMap);
        if (isMounted) {
          setLogs(data);
        }
      } catch (err) {
        console.warn('Backend violations offline:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadViolations();
    return () => { isMounted = false; };
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.camera_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;
    return matchesSearch && matchesSeverity;
  });

  return (
    <div>
      {/* Top search & filter bar */}
      <div className={styles.topBar} style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Tìm kiếm vi phạm theo camera hoặc loại lỗi..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)', fontSize: '14px' }}
          />
        </div>
        
        <select 
          value={selectedSeverity} 
          onChange={(e) => setSelectedSeverity(e.target.value)}
          style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)', fontSize: '14px' }}
        >
          <option value="all" style={{ background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}>Tất cả mức độ</option>
          <option value="danger" style={{ background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}>🚨 Nguy hiểm (Danger)</option>
          <option value="warning" style={{ background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}>⚠️ Cảnh báo (Warning)</option>
          <option value="info" style={{ background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}>ℹ️ Thông tin (Info)</option>
        </select>
      </div>

      {/* Main table container */}
      <div className="glass-panel" style={{ overflow: 'hidden', padding: '0' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            ⏳ Đang tải dữ liệu vi phạm từ Backend...
          </div>
        ) : filteredLogs.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '16px 20px' }}>Mã / ID</th>
                <th style={{ padding: '16px 20px' }}>Thởi gian</th>
                <th style={{ padding: '16px 20px' }}>Camera</th>
                <th style={{ padding: '16px 20px' }}>Loại vi phạm</th>
                <th style={{ padding: '16px 20px' }}>Mức độ</th>
                <th style={{ padding: '16px 20px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '16px 20px', fontFamily: 'monospace' }}>{log.id}</td>
                  <td style={{ padding: '16px 20px' }}>{log.timestamp}</td>
                  <td style={{ padding: '16px 20px' }}>{log.camera_id}</td>
                  <td style={{ padding: '16px 20px', fontWeight: 'bold' }}>{mapViolationType(log.type)}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span 
                      style={{ 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '12px',
                        background: log.severity === 'danger' ? 'rgba(239,68,68,0.2)' : log.severity === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)',
                        color: log.severity === 'danger' ? '#ef4444' : log.severity === 'warning' ? '#f59e0b' : '#3b82f6'
                      }}
                    >
                      {log.severity.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <button 
                      className="btn btn-outline" 
                      style={{ fontSize: '12px', padding: '4px 12px' }}
                      onClick={() => setSelectedLog(log)}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '12px', opacity: 0.4 }}>verified</span>
            Chưa có ghi nhận sự cố vi phạm nào trong cơ sở dữ liệu.
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (() => {
        const imageUrl = selectedLog.image_url
          ? (selectedLog.image_url.startsWith('http')
              ? selectedLog.image_url
              : `${API_BASE.replace('/api/v1', '')}${selectedLog.image_url}`)
          : null;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '24px', background: '#111827', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Chi tiết sự cố {selectedLog.id}</h3>
                <button className="btn btn-outline" onClick={() => setSelectedLog(null)}>Đóng</button>
              </div>

              <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                <div><strong>Loại vi phạm:</strong> {mapViolationType(selectedLog.type)}</div>
                <div><strong>Camera:</strong> {selectedLog.camera_id}</div>
                <div><strong>Thời gian:</strong> {selectedLog.timestamp}</div>
                <div><strong>Mức độ:</strong> {selectedLog.severity.toUpperCase()}</div>
                <div><strong>Trạng thái:</strong> {selectedLog.status}</div>
                {selectedLog.details && (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                    {selectedLog.details}
                  </div>
                )}
                {imageUrl && (
                  <div style={{ marginTop: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img src={imageUrl} alt="Violation Evidence" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', display: 'block', background: '#000' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
