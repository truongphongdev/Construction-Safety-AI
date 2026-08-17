import { useState, useEffect, useCallback } from 'react';
import styles from './ViolationsPage.module.css';
import { fetchViolationsPaged, fetchCameras } from '../../services';
import type { Violation } from '../../services';
import { mapViolationType } from '@/utils/translation';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const SERVER_BASE = API_BASE.replace('/api/v1', '');

export default function ViolationsPage() {
  const [logs, setLogs] = useState<Violation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedLog, setSelectedLog] = useState<Violation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [cameraMap, setCameraMap] = useState<Record<string, string>>({});

  // 1. Load Camera mapping on mount
  useEffect(() => {
    let isMounted = true;
    fetchCameras().then(cams => {
      if (!isMounted) return;
      const map: Record<string, string> = {};
      cams.forEach(c => {
        if (c.id && c.name) map[c.id] = c.name;
      });
      setCameraMap(map);
    }).catch(err => console.warn('Không thể tải camera map:', err));

    return () => { isMounted = false; };
  }, []);

  // 2. Fetch Paginated Violations
  const loadData = useCallback(async (page: number, size: number) => {
    setIsLoading(true);
    try {
      const res = await fetchViolationsPaged(page, size, cameraMap);
      setLogs(res.items);
      setTotalRecords(res.total);
      setTotalPages(res.totalPages);
      setCurrentPage(res.page);
    } catch (err) {
      console.warn('Backend violations offline:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cameraMap]);

  useEffect(() => {
    loadData(currentPage, pageSize);
  }, [currentPage, pageSize, loadData]);

  // Client-side search and severity filter on current page items
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = !searchTerm || 
      log.camera_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;
    return matchesSearch && matchesSeverity;
  });

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value, 10);
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page
  };

  // Generate page numbers for pagination bar
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  // Resolve media URL (video/image)
  const resolveMediaUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/static/')) return `${SERVER_BASE}${path}`;
    if (path.startsWith('/')) return `${SERVER_BASE}${path}`;
    return `${SERVER_BASE}/static/violations/${path}`;
  };

  const startRecord = totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div>
      {/* Top search & filter bar */}
      <div className={styles.topBar} style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Tìm kiếm vi phạm theo camera, mã ID hoặc loại lỗi..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '10px 16px', borderRadius: '8px', 
              border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', 
              color: 'var(--on-surface)', fontSize: '14px', boxSizing: 'border-box'
            }}
          />
        </div>
        
        <select 
          value={selectedSeverity} 
          onChange={(e) => setSelectedSeverity(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="all">Tất cả mức độ</option>
          <option value="danger">🚨 Nguy hiểm (Danger)</option>
          <option value="warning">⚠️ Cảnh báo (Warning)</option>
          <option value="info">ℹ️ Thông tin (Info)</option>
        </select>

        <button 
          className="btn btn-outline" 
          onClick={() => loadData(currentPage, pageSize)}
          title="Làm mới dữ liệu"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', height: '40px' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
          Làm mới
        </button>
      </div>

      {/* Main table container */}
      <div className="glass-panel" style={{ overflow: 'hidden', padding: '0', borderRadius: '12px' }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '36px', animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '10px' }}>sync</span>
            <div>Đang tải danh sách sự cố vi phạm...</div>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--outline-variant)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Mã Sự cố</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Thời gian</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Camera</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Loại vi phạm</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Mức độ</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Dữ liệu bằng chứng</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--on-surface-variant)' }}>
                      {log.id.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                    <td style={{ padding: '14px 20px', fontWeight: 500 }}>{log.camera_id}</td>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--on-surface)' }}>
                      {mapViolationType(log.type)}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span 
                        style={{ 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          fontSize: '11px',
                          fontWeight: 600,
                          background: log.severity === 'danger' ? 'rgba(239,68,68,0.2)' : log.severity === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)',
                          color: log.severity === 'danger' ? '#ef4444' : log.severity === 'warning' ? '#f59e0b' : '#3b82f6'
                        }}
                      >
                        {log.severity.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {log.video_url ? (
                        <span className={`${styles.mediaBadge} ${styles.mediaBadgeVideo}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>videocam</span>
                          Video MP4
                        </span>
                      ) : log.image_url ? (
                        <span className={styles.mediaBadge}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>image</span>
                          Ảnh chụp
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Không có</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ fontSize: '12px', padding: '5px 14px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setSelectedLog(log)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>play_circle</span>
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '12px', opacity: 0.4 }}>verified</span>
            Chưa có ghi nhận sự cố vi phạm nào trong cơ sở dữ liệu.
          </div>
        )}

        {/* ── Pagination Controls ───────────────────────────────────────── */}
        <div className={styles.paginationContainer}>
          <div className={styles.paginationInfo}>
            <span>
              Hiển thị <strong>{startRecord}</strong> - <strong>{endRecord}</strong> trong tổng số <strong>{totalRecords}</strong> bản ghi
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
              <span>Số dòng:</span>
              <select 
                className={styles.pageSizeSelect}
                value={pageSize}
                onChange={handlePageSizeChange}
              >
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
              </select>
            </div>
          </div>

          <div className={styles.paginationControls}>
            <button 
              className={styles.pageBtn} 
              onClick={() => handlePageChange(1)} 
              disabled={currentPage === 1}
              title="Trang đầu"
            >
              «
            </button>
            <button 
              className={styles.pageBtn} 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage === 1}
              title="Trang trước"
            >
              ‹
            </button>

            {getPageNumbers().map((p, idx) => (
              typeof p === 'number' ? (
                <button
                  key={idx}
                  className={`${styles.pageBtn} ${currentPage === p ? styles.pageBtnActive : ''}`}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </button>
              ) : (
                <span key={idx} style={{ padding: '0 4px', color: 'var(--text-secondary)' }}>...</span>
              )
            ))}

            <button 
              className={styles.pageBtn} 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage === totalPages || totalPages === 0}
              title="Trang tiếp"
            >
              ›
            </button>
            <button 
              className={styles.pageBtn} 
              onClick={() => handlePageChange(totalPages)} 
              disabled={currentPage === totalPages || totalPages === 0}
              title="Trang cuối"
            >
              »
            </button>
          </div>
        </div>
      </div>

      {/* ── Log Details & Video Player Modal ────────────────────────────── */}
      {selectedLog && (() => {
        const videoUrl = resolveMediaUrl(selectedLog.video_url);
        const imageUrl = resolveMediaUrl(selectedLog.image_url);

        return (
          <div 
            style={{ 
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', 
              backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', 
              alignItems: 'center', justifyContent: 'center', padding: '24px' 
            }}
            onClick={() => setSelectedLog(null)}
          >
            <div 
              className="glass-panel" 
              style={{ 
                width: '100%', maxWidth: '680px', padding: '24px', 
                background: 'var(--surface-lowest)', borderRadius: '12px',
                border: '1px solid var(--outline-variant)', boxShadow: 'var(--shadow-lg)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  🎬 Chi tiết Video & Sự cố Vi phạm
                </h3>
                <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => setSelectedLog(null)}>
                  ✕ Đóng
                </button>
              </div>

              {/* Video Player or Image Evidence */}
              <div style={{ width: '100%', minHeight: '260px', background: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {videoUrl ? (
                  <video 
                    src={videoUrl} 
                    controls 
                    autoPlay 
                    loop 
                    playsInline
                    style={{ width: '100%', maxHeight: '360px', objectFit: 'contain' }}
                  />
                ) : imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt="Evidence" 
                    style={{ width: '100%', maxHeight: '360px', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Không có file video hoặc hình ảnh ghi nhận.
                  </div>
                )}
              </div>

              {/* Metadata details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div><strong>Loại vi phạm:</strong> {mapViolationType(selectedLog.type)}</div>
                <div><strong>Camera:</strong> {selectedLog.camera_id}</div>
                <div><strong>Thời gian:</strong> {selectedLog.timestamp}</div>
                <div>
                  <strong>Mức độ:</strong>{' '}
                  <span style={{ 
                    color: selectedLog.severity === 'danger' ? '#ef4444' : selectedLog.severity === 'warning' ? '#f59e0b' : '#3b82f6',
                    fontWeight: 700 
                  }}>
                    {selectedLog.severity.toUpperCase()}
                  </span>
                </div>
                <div><strong>Trạng thái:</strong> {selectedLog.status}</div>
                <div><strong>Mã Record:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedLog.id}</span></div>
              </div>

              {selectedLog.details && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--surface-low)', borderRadius: '6px', fontSize: '12px', color: 'var(--on-surface-variant)', maxHeight: '100px', overflowY: 'auto' }}>
                  <strong>AI Metadata:</strong> {selectedLog.details}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
