import { useState, useEffect, useRef } from 'react';
import styles from './CamerasPage.module.css';

interface Camera {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  ipAddress: string;
  model: string;
  videoUrl?: string; // Optional URL for demo video
}

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([
    { id: '01', name: 'CAM-01', location: 'Cổng chính (Main Gate)', status: 'online', ipAddress: '192.168.1.101', model: 'YOLOv8 Security Suite', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-security-camera-footage-of-a-corridor-42404-large.mp4' },
    { id: '02', name: 'CAM-02', location: 'Sảnh đón khách (Lobby)', status: 'online', ipAddress: '192.168.1.102', model: 'YOLOv8 Security Suite', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-people-walking-in-a-modern-office-43026-large.mp4' },
    { id: '03', name: 'CAM-03', location: 'Kho hàng B (Warehouse B)', status: 'online', ipAddress: '192.168.1.103', model: 'YOLOv8 Security Suite' },
    { id: '04', name: 'CAM-04', location: 'Xưởng đóng gói (Packaging)', status: 'online', ipAddress: '192.168.1.104', model: 'YOLOv8 Security Suite', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-industrial-robotic-arms-welding-components-48906-large.mp4' },
    { id: '05', name: 'CAM-05', location: 'Văn phòng hành chính', status: 'online', ipAddress: '192.168.1.105', model: 'YOLOv8 Security Suite', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-security-guard-monitoring-in-control-room-42401-large.mp4' },
    { id: '06', name: 'CAM-06', location: 'Cổng phụ xe tải', status: 'offline', ipAddress: '192.168.1.106', model: 'Không cấu hình' }
  ]);

  const [overlayActive, setOverlayActive] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCamName, setNewCamName] = useState('');
  const [newCamLoc, setNewCamLoc] = useState('');
  
  // Video selection state for adding a camera
  const [newCamVideoType, setNewCamVideoType] = useState<'preset' | 'local' | 'none'>('preset');
  const [newCamVideoPreset, setNewCamVideoPreset] = useState('https://assets.mixkit.co/videos/preview/mixkit-security-camera-footage-of-a-corridor-42404-large.mp4');
  const [newCamVideoFile, setNewCamVideoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Zoomed camera details
  const [zoomedCamId, setZoomedCamId] = useState<string | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);
  const [telemetryStats, setTelemetryStats] = useState({ fps: 30, latency: 12, cpu: 24 });

  // Canvas drawing ref for a mock live stream inside the card (similar to Cam 03)
  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});

  useEffect(() => {
    // Set up canvas animation for CAM-03 inside the cameras list & zoom modal
    const canvas = canvasRefs.current['03'];
    const zoomCanvas = canvasRefs.current['zoom-03'];
    
    let frameId: number;
    const worker = { x: 50, y: 70, dx: 1.0, dy: 0.2 };
    const workerZoom = { x: 100, y: 140, dx: 2.0, dy: 0.4 };

    const animate = () => {
      // Draw grid & box on small canvas
      if (canvas && cameras.find(c => c.id === '03')?.status === 'online') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw grid
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.05)';
          ctx.lineWidth = 1;
          for (let i = 0; i < canvas.width; i += 20) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
          }

          // Move box
          worker.x += worker.dx;
          worker.y += worker.dy;
          if (worker.x < 20 || worker.x > canvas.width - 60) worker.dx *= -1;
          if (worker.y < 20 || worker.y > canvas.height - 70) worker.dy *= -1;

          // Draw box overlay if enabled
          if (overlayActive) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.strokeRect(worker.x, worker.y, 40, 60);

            ctx.fillStyle = '#ef4444';
            ctx.fillRect(worker.x, worker.y - 15, 40, 15);

            ctx.fillStyle = '#ffffff';
            ctx.font = '8px Inter';
            ctx.fillText('NO-HELMET', worker.x + 2, worker.y - 4);

            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc(worker.x + 20, worker.y + 10, 5, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(worker.x, worker.y, 40, 60);
          }

          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = '9px Courier New';
          ctx.fillText(`CAM-03 LIVE FEED`, 10, 20);
        }
      }

      // Draw grid & box on zoomed canvas
      if (zoomCanvas && cameras.find(c => c.id === '03')?.status === 'online') {
        const ctxZoom = zoomCanvas.getContext('2d');
        if (ctxZoom) {
          ctxZoom.fillStyle = '#0f172a';
          ctxZoom.fillRect(0, 0, zoomCanvas.width, zoomCanvas.height);

          // Draw grid
          ctxZoom.strokeStyle = 'rgba(125, 211, 252, 0.05)';
          ctxZoom.lineWidth = 1;
          for (let i = 0; i < zoomCanvas.width; i += 40) {
            ctxZoom.beginPath(); ctxZoom.moveTo(i, 0); ctxZoom.lineTo(i, zoomCanvas.height); ctxZoom.stroke();
          }

          // Move box
          workerZoom.x += workerZoom.dx;
          workerZoom.y += workerZoom.dy;
          if (workerZoom.x < 40 || workerZoom.x > zoomCanvas.width - 120) workerZoom.dx *= -1;
          if (workerZoom.y < 40 || workerZoom.y > zoomCanvas.height - 140) workerZoom.dy *= -1;

          // Draw box overlay if enabled
          if (overlayActive) {
            ctxZoom.strokeStyle = '#ef4444';
            ctxZoom.lineWidth = 3;
            ctxZoom.strokeRect(workerZoom.x, workerZoom.y, 80, 120);

            ctxZoom.fillStyle = '#ef4444';
            ctxZoom.fillRect(workerZoom.x, workerZoom.y - 24, 80, 24);

            ctxZoom.fillStyle = '#ffffff';
            ctxZoom.font = '12px Inter';
            ctxZoom.fillText('NO-HELMET', workerZoom.x + 6, workerZoom.y - 7);

            ctxZoom.fillStyle = '#ef4444';
            ctxZoom.beginPath(); ctxZoom.arc(workerZoom.x + 40, workerZoom.y + 20, 10, 0, Math.PI * 2); ctxZoom.fill();
          } else {
            ctxZoom.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctxZoom.lineWidth = 2.5;
            ctxZoom.strokeRect(workerZoom.x, workerZoom.y, 80, 120);
          }

          ctxZoom.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctxZoom.font = '14px Courier New';
          ctxZoom.fillText(`CAM-03 DETAILED ANALYTICS FEED`, 20, 35);
        }
      }

      frameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(frameId);
  }, [overlayActive, cameras, zoomedCamId]);

  // Telemetry updates when zoom modal is open
  const zoomedCam = cameras.find(c => c.id === zoomedCamId);
  useEffect(() => {
    if (!zoomedCamId || !zoomedCam || zoomedCam.status === 'offline') return;

    setTelemetryLogs([
      `[${new Date().toLocaleTimeString()}] System: Camera connection established.`,
      `[${new Date().toLocaleTimeString()}] AI Engine: YOLOv8 Security model active.`,
      `[${new Date().toLocaleTimeString()}] AI Engine: Processing stream at 1080p...`
    ]);

    const statsInterval = setInterval(() => {
      setTelemetryStats({
        fps: Math.round(28 + Math.random() * 4),
        latency: Math.round(10 + Math.random() * 8),
        cpu: Math.round(20 + Math.random() * 15)
      });
    }, 1500);

    const logDetections = ['PERSON', 'HELMET', 'NO-HELMET', 'SAFETY-VEST', 'FORKLIFT', 'ROBOTIC_ARM'];
    const logsInterval = setInterval(() => {
      const randomDet = logDetections[Math.floor(Math.random() * logDetections.length)];
      const conf = Math.round(85 + Math.random() * 14);
      setTelemetryLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Detect: ${randomDet} (${conf}%)`,
        ...prev.slice(0, 6)
      ]);
    }, 3000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(logsInterval);
    };
  }, [zoomedCamId, cameras]);

  const toggleCameraPower = (id: string) => {
    setCameras(prev => prev.map(c => {
      if (c.id === id) {
        const nextStatus = c.status === 'online' ? 'offline' : 'online';
        return {
          ...c,
          status: nextStatus,
          model: nextStatus === 'online' ? (c.model === 'Không cấu hình' ? 'YOLOv8 Security Suite' : c.model) : 'Không cấu hình'
        };
      }
      return c;
    }));
  };

  const handleAddCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamName || !newCamLoc) {
      alert('Vui lòng điền đủ thông tin');
      return;
    }

    let videoUrl = undefined;
    if (newCamVideoType === 'preset') {
      videoUrl = newCamVideoPreset;
    } else if (newCamVideoType === 'local' && newCamVideoFile) {
      videoUrl = URL.createObjectURL(newCamVideoFile);
    }

    const newId = (cameras.length + 1).toString().padStart(2, '0');
    const newCam: Camera = {
      id: newId,
      name: newCamName,
      location: newCamLoc,
      status: 'online',
      ipAddress: `192.168.1.${100 + cameras.length + 1}`,
      model: 'YOLOv8 Security Suite',
      videoUrl: videoUrl
    };

    setCameras([...cameras, newCam]);
    setNewCamName('');
    setNewCamLoc('');
    setNewCamVideoFile(null);
    setShowAddModal(false);
  };

  return (
    <div>
      <div className={styles.topBar}>
        <button 
          className="btn btn-outline"
          onClick={() => setOverlayActive(!overlayActive)}
        >
          <span className="material-symbols-outlined">
            {overlayActive ? 'visibility' : 'visibility_off'}
          </span>
          {overlayActive ? 'Tắt AI Overlays' : 'Bật AI Overlays'}
        </button>
        
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <span className="material-symbols-outlined">add</span>
          Thêm Camera mới
        </button>
      </div>

      {/* Cameras Grid */}
      <div className={styles.camerasGrid}>
        {cameras.map((cam) => (
          <div 
            key={cam.id} 
            className={`${styles.cameraCard} glass-panel`}
            onClick={() => setZoomedCamId(cam.id)}
            style={{ cursor: 'pointer' }}
          >
            <div className={styles.streamContainer}>
              <span className={styles.badgeOverlay}>{cam.name}</span>
              
              {/* Power Control Button */}
              <button
                className={styles.powerBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCameraPower(cam.id);
                }}
                title={cam.status === 'online' ? 'Tắt camera' : 'Bật camera'}
              >
                <span className="material-symbols-outlined">
                  {cam.status === 'online' ? 'power' : 'power_off'}
                </span>
              </button>

              {cam.id === '03' && cam.status === 'online' ? (
                <canvas 
                  ref={(el) => { canvasRefs.current[cam.id] = el; }} 
                  width={300} 
                  height={170} 
                  className={styles.canvas}
                />
              ) : cam.status === 'online' && cam.videoUrl ? (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <video 
                    src={cam.videoUrl} 
                    autoPlay 
                    muted 
                    loop 
                    playsInline 
                    className={styles.videoStream}
                  />
                  {overlayActive && (
                    <div className={styles.videoOverlay}>
                      <div className={styles.detectBox} style={{ top: '25%', left: '20%', width: '30%', height: '55%' }}>
                        <span className={styles.detectLabel}>PERSON 98%</span>
                      </div>
                      {cam.id === '04' && (
                        <div className={styles.detectBox} style={{ top: '15%', left: '55%', width: '35%', height: '45%', borderColor: 'var(--color-warning)' }}>
                          <span className={styles.detectLabel} style={{ backgroundColor: 'var(--color-warning)' }}>ROBOTIC_ARM 99%</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : cam.status === 'online' ? (
                <div className={styles.streamPlaceholder} style={{ zIndex: 1 }}>
                  <span className="material-symbols-outlined text-4xl" style={{ color: 'rgba(37,99,235,0.3)' }}>videocam</span>
                  <span style={{ fontSize: '12px' }}>Live Feed Active (No video)</span>
                  {overlayActive && (
                    <div style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 'bold' }}>
                      🟢 [AI Safe State Detected]
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.streamPlaceholder}>
                  <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--on-surface-variant)' }}>videocam_off</span>
                  <span>Camera Offline</span>
                </div>
              )}
            </div>

            <div className={styles.cardFooter}>
              <div>
                <div className={styles.camName}>{cam.location}</div>
                <div className={styles.camLocation}>{cam.ipAddress} • {cam.model}</div>
              </div>
              
              <div className={styles.statusIndicator}>
                <span 
                  className={styles.statusCircle}
                  style={{ 
                    backgroundColor: cam.status === 'online' ? 'var(--color-success)' : 'var(--outline)',
                    boxShadow: cam.status === 'online' ? '0 0 6px var(--color-success)' : 'none'
                  }}
                ></span>
                <span style={{ textTransform: 'capitalize', fontSize: '11px', fontWeight: 600 }}>{cam.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Zoom Camera Feed Modal */}
      {zoomedCamId && zoomedCam && (
        <div className={styles.zoomModalOverlay} onClick={() => setZoomedCamId(null)}>
          <div className={`${styles.zoomCard} glass-panel`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.zoomHeader}>
              <div className={styles.zoomTitleGroup}>
                <h3 className={styles.zoomTitle}>{zoomedCam.location}</h3>
                <span className={styles.zoomSubtitle}>{zoomedCam.name} • {zoomedCam.ipAddress}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className={`${styles.zoomControlBtn} ${zoomedCam.status === 'online' ? styles.btnOnline : styles.btnOffline}`}
                  onClick={() => toggleCameraPower(zoomedCam.id)}
                  title={zoomedCam.status === 'online' ? 'Tắt camera' : 'Bật camera'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {zoomedCam.status === 'online' ? 'power' : 'power_off'}
                  </span>
                  <span>{zoomedCam.status === 'online' ? 'Hoạt động' : 'Ngoại tuyến'}</span>
                </button>
                <button className={styles.zoomCloseBtn} onClick={() => setZoomedCamId(null)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className={styles.zoomBodyGrid}>
              {/* Left Column: Big Stream */}
              <div className={styles.zoomStreamContainer}>
                {zoomedCam.id === '03' && zoomedCam.status === 'online' ? (
                  <div className={styles.zoomVideoWrapper}>
                    <canvas 
                      ref={(el) => { canvasRefs.current[`zoom-${zoomedCam.id}`] = el; }} 
                      width={600} 
                      height={340} 
                      className={styles.canvas}
                    />
                  </div>
                ) : zoomedCam.status === 'online' && zoomedCam.videoUrl ? (
                  <div className={styles.zoomVideoWrapper}>
                    <video 
                      src={zoomedCam.videoUrl} 
                      autoPlay 
                      muted 
                      loop 
                      playsInline 
                      className={styles.zoomVideo}
                    />
                    {overlayActive && (
                      <div className={styles.videoOverlay}>
                        <div className={styles.detectBox} style={{ top: '25%', left: '20%', width: '30%', height: '55%' }}>
                          <span className={styles.detectLabel}>PERSON 98%</span>
                        </div>
                        {zoomedCam.id === '04' && (
                          <div className={styles.detectBox} style={{ top: '15%', left: '55%', width: '35%', height: '45%', borderColor: 'var(--color-warning)' }}>
                            <span className={styles.detectLabel} style={{ backgroundColor: 'var(--color-warning)' }}>ROBOTIC_ARM 99%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : zoomedCam.status === 'online' ? (
                  <div className={styles.zoomPlaceholder}>
                    <span className="material-symbols-outlined text-6xl" style={{ color: 'rgba(37,99,235,0.3)', marginBottom: '12px' }}>videocam</span>
                    <span style={{ fontSize: '14px' }}>Live Stream Active (No video feed configured)</span>
                  </div>
                ) : (
                  <div className={styles.zoomPlaceholder}>
                    <span className="material-symbols-outlined text-6xl" style={{ color: 'var(--outline)', marginBottom: '12px' }}>videocam_off</span>
                    <span style={{ fontSize: '14px' }}>Camera is Offline</span>
                  </div>
                )}
              </div>

              {/* Right Column: Telemetry & Logs */}
              <div className={styles.zoomTelemetryPanel}>
                <h4 className={styles.panelSectionTitle}>AI Diagnostics & Telemetry</h4>
                
                {zoomedCam.status === 'online' ? (
                  <>
                    <div className={styles.telemetryStatsGrid}>
                      <div className={styles.statCard}>
                        <span className={styles.statLabel}>FPS</span>
                        <span className={styles.statValue}>{telemetryStats.fps}</span>
                      </div>
                      <div className={styles.statCard}>
                        <span className={styles.statLabel}>Độ trễ</span>
                        <span className={styles.statValue}>{telemetryStats.latency} ms</span>
                      </div>
                      <div className={styles.statCard}>
                        <span className={styles.statLabel}>CPU AI</span>
                        <span className={styles.statValue}>{telemetryStats.cpu}%</span>
                      </div>
                    </div>

                    <div className={styles.logsContainer}>
                      <span className={styles.logsLabel}>Nhật ký Phân tích AI</span>
                      <div className={styles.logsList}>
                        {telemetryLogs.map((log, index) => (
                          <div key={index} className={styles.logRow}>{log}</div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.modelMeta}>
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Cấu hình Model:</span>
                        <span className={styles.metaValue}>{zoomedCam.model}</span>
                      </div>
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Trạng thái AI:</span>
                        <span className={styles.metaValue} style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>Đang giám sát</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={styles.telemetryOfflineMessage}>
                    <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--outline)', marginBottom: '8px' }}>sensors_off</span>
                    <span>Hệ thống AI Ngoại tuyến</span>
                    <p>Hãy bật camera để kết nối lại luồng phân tích.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Camera Dialog Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{ padding: '24px', width: '420px', backgroundColor: 'var(--surface-lowest)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Cấu hình Camera mới</h3>
            
            <form onSubmit={handleAddCamera} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label className="input-label" htmlFor="camName">Mã Camera</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    id="camName" 
                    className="input-field" 
                    placeholder="Ví dụ: CAM-07" 
                    value={newCamName}
                    onChange={(e) => setNewCamName(e.target.value)}
                    required
                    style={{ paddingLeft: '12px' }}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="camLoc">Vị trí Lắp đặt</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    id="camLoc" 
                    className="input-field" 
                    placeholder="Ví dụ: Nhà để xe máy" 
                    value={newCamLoc}
                    onChange={(e) => setNewCamLoc(e.target.value)}
                    required
                    style={{ paddingLeft: '12px' }}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Nguồn Video Demo</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="videoType" 
                      checked={newCamVideoType === 'preset'}
                      onChange={() => setNewCamVideoType('preset')}
                    />
                    Mẫu có sẵn
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="videoType" 
                      checked={newCamVideoType === 'local'}
                      onChange={() => setNewCamVideoType('local')}
                    />
                    Chọn từ máy tính
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="videoType" 
                      checked={newCamVideoType === 'none'}
                      onChange={() => setNewCamVideoType('none')}
                    />
                    Không dùng
                  </label>
                </div>

                {newCamVideoType === 'preset' && (
                  <select
                    className="input-field"
                    value={newCamVideoPreset}
                    onChange={(e) => setNewCamVideoPreset(e.target.value)}
                    style={{ height: '38px', padding: '0 8px', fontSize: '13px', borderRadius: 'var(--radius-md)' }}
                  >
                    <option value="https://assets.mixkit.co/videos/preview/mixkit-security-camera-footage-of-a-corridor-42404-large.mp4">Hành lang an ninh (Hành lang)</option>
                    <option value="https://assets.mixkit.co/videos/preview/mixkit-people-walking-in-a-modern-office-43026-large.mp4">Sảnh Văn Phòng (Văn phòng)</option>
                    <option value="https://assets.mixkit.co/videos/preview/mixkit-industrial-robotic-arms-welding-components-48906-large.mp4">Dây chuyền Công nghiệp (Robot Hàn)</option>
                    <option value="https://assets.mixkit.co/videos/preview/mixkit-security-guard-monitoring-in-control-room-42401-large.mp4">Phòng giám sát (Control Room)</option>
                  </select>
                )}

                {newCamVideoType === 'local' && (
                  <div className={styles.fileUploadContainer}>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      accept="video/*" 
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setNewCamVideoFile(e.target.files[0]);
                        }
                      }}
                    />
                    <button 
                      type="button" 
                      className={styles.fileUploadBtn}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className="material-symbols-outlined">video_file</span>
                      <span>Chọn file video...</span>
                    </button>
                    {newCamVideoFile && (
                      <div className={styles.fileNameDisplay}>
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className={styles.fileName} title={newCamVideoFile.name}>
                          {newCamVideoFile.name}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" style={{ height: '36px' }} onClick={() => setShowAddModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ height: '36px' }}>
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
