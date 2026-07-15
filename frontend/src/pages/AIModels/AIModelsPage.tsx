import { useState } from 'react';
import styles from './AIModelsPage.module.css';

interface ModelVersion {
  version: string;
  releaseDate: string;
  accuracy: string;
  status: 'Running' | 'Offline';
}

export default function AIModelsPage() {
  const [versions, setVersions] = useState<ModelVersion[]>([
    { version: 'v2.4.0', releaseDate: '2026-06-01', accuracy: '98.2%', status: 'Running' },
    { version: 'v2.3.5', releaseDate: '2026-04-15', accuracy: '97.8%', status: 'Offline' },
    { version: 'v2.3.0', releaseDate: '2026-02-01', accuracy: '96.5%', status: 'Offline' },
  ]);

  const [activeModel, setActiveModel] = useState({
    name: 'YOLOv8 Security Suite',
    version: 'v2.4.0',
    accuracy: '98.2%'
  });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [confidence, setConfidence] = useState(0.65);
  const [iou, setIou] = useState(0.45);
  const [maxDetections, setMaxDetections] = useState(100);

  const handleSwitchVersion = (targetVersion: string) => {
    const matched = versions.find(v => v.version === targetVersion);
    if (!matched) return;

    // Toggle statuses
    const updatedVersions = versions.map((v) => ({
      ...v,
      status: v.version === targetVersion ? ('Running' as const) : ('Offline' as const)
    }));

    setVersions(updatedVersions);
    setActiveModel({
      name: 'YOLOv8 Security Suite',
      version: matched.version,
      accuracy: matched.accuracy
    });
    
    alert(`Đang chuyển sang phiên bản model ${targetVersion}. Hệ thống sẽ khởi động lại luồng phân tích trong giây lát.`);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Lưu tham số thành công: \n- Confidence: ${confidence} \n- IoU: ${iou} \n- Max Detections: ${maxDetections}`);
    setShowConfigModal(false);
  };

  return (
    <div>
      {/* Current Active Model Card */}
      <div className={`${styles.card} glass-panel`}>
        <div className={styles.row}>
          <div>
            <div className={styles.titleRow}>
              <span className="material-symbols-outlined text-primary text-3xl icon-filled">psychology</span>
              <h2 className={styles.modelName}>{activeModel.name}</h2>
              <span className="badge badge-success">
                <span className="status-dot-active" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }}></span>
                Running
              </span>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Version</span>
                <span className={styles.statValue}>{activeModel.version}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Accuracy (mAP)</span>
                <span className={styles.statValue}>{activeModel.accuracy}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Processing Speed</span>
                <span className={styles.statValue}>18ms / frame</span>
              </div>
            </div>
          </div>

          <div>
            <button 
              className="btn btn-outline"
              onClick={() => setShowConfigModal(true)}
            >
              <span className="material-symbols-outlined">tune</span>
              Cấu hình tham số
            </button>
          </div>
        </div>
      </div>

      {/* Model Version History */}
      <h3 className={styles.sectionHeader}>Lịch sử phiên bản</h3>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Phiên bản</th>
              <th className={styles.th}>Ngày phát hành</th>
              <th className={styles.th}>Độ chính xác (mAP)</th>
              <th className={styles.th}>Trạng thái</th>
              <th className={`${styles.th} ${styles.actionsCell}`}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((ver) => (
              <tr key={ver.version} className={styles.tr}>
                <td className={`${styles.td} ${styles.modelNameTd}`}>{ver.version}</td>
                <td className={styles.td}>{ver.releaseDate}</td>
                <td className={styles.td}>{ver.accuracy}</td>
                <td className={styles.td}>
                  <span className={`badge ${ver.status === 'Running' ? 'badge-success' : 'badge-secondary'}`}>
                    {ver.status}
                  </span>
                </td>
                <td className={`${styles.td} ${styles.actionsCell}`}>
                  {ver.status === 'Offline' ? (
                    <button 
                      className="btn btn-outline"
                      style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                      onClick={() => handleSwitchVersion(ver.version)}
                    >
                      Kích hoạt bản này
                    </button>
                  ) : (
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)' }}>Bản hiện tại</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Configuration Parameter Dialog */}
      {showConfigModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{ padding: '24px', width: '420px', backgroundColor: 'var(--surface-lowest)' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>Cấu hình tham số YOLOv8</h3>
            <form onSubmit={handleSaveConfig}>
              
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="input-label" htmlFor="confidence">Confidence Threshold</label>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{confidence}</span>
                </div>
                <input 
                  type="range" 
                  id="confidence" 
                  min="0.10" 
                  max="0.99" 
                  step="0.05"
                  value={confidence}
                  onChange={(e) => setConfidence(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="input-label" htmlFor="iou">IoU Threshold</label>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{iou}</span>
                </div>
                <input 
                  type="range" 
                  id="iou" 
                  min="0.10" 
                  max="0.95" 
                  step="0.05"
                  value={iou}
                  onChange={(e) => setIou(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label className="input-label" htmlFor="maxDetections">Max Detections per frame</label>
                <input 
                  type="number" 
                  id="maxDetections"
                  className="input-field"
                  value={maxDetections}
                  onChange={(e) => setMaxDetections(parseInt(e.target.value))}
                  style={{ paddingLeft: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-outline" style={{ height: '36px' }} onClick={() => setShowConfigModal(false)}>
                  Đóng
                </button>
                <button type="submit" className="btn btn-primary" style={{ height: '36px' }}>
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
