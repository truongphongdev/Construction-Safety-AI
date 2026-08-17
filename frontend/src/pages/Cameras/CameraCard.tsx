import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './CamerasPage.module.css';
import { useWebcam } from '@/contexts/WebcamContext';
import type { DetectedObject } from '@/contexts/WebcamContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface CameraItem {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  rtspUrl?: string;
  videoName?: string;
  videoBlob?: string;
}

interface CameraCardProps {
  cam: CameraItem;
  onAssignVideo?: (camId: string, videoName: string) => void;
  onUploadFile: (camId: string, file: File) => void;
  onDelete: (camId: string) => void;
}

export function CameraCard({ cam, onUploadFile, onDelete }: CameraCardProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [localDetections, setLocalDetections] = useState<DetectedObject[]>([]);
  
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const zoomVideoRef = useRef<HTMLVideoElement | null>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const isAnalyzingRef = useRef<boolean>(false);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Global webcam state
  const { isWebcamActive, webcamStream, detections: webcamDetections, startWebcam, stopWebcam, cameraId } = useWebcam();
  
  const isThisCameraWebcam = cam.id === cameraId;
  const isWebcamRunningHere = isThisCameraWebcam && isWebcamActive;
  const hasLocalVideo = Boolean(cam.videoBlob);

  // Helper vẽ bounding box
  const drawBoxes = useCallback((canvas: HTMLCanvasElement | null, detections: DetectedObject[]) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / 640;
    const scaleY = canvas.height / 480;

    detections.forEach(det => {
      const [xmin, ymin, xmax, ymax] = det.bbox;
      const x = xmin * scaleX;
      const y = ymin * scaleY;
      const w = (xmax - xmin) * scaleX;
      const h = (ymax - ymin) * scaleY;

      const isVio = det.is_violation;
      const strokeColor = isVio ? '#ef4444' : '#22c55e';
      const bgColor = isVio ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)';

      // Box viền
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(x, y, w, h);

      // Label background & text
      const labelText = `${isVio ? '⚠️ ' : '✓ '}${det.label.toUpperCase()} (${(det.confidence * 100).toFixed(0)}%)`;
      ctx.font = 'bold 12px Inter, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width + 12;
      const textHeight = 20;

      ctx.fillStyle = bgColor;
      ctx.fillRect(x, Math.max(0, y - textHeight), textWidth, textHeight);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x + 6, Math.max(14, y - 5));
    });
  }, []);

  // Gán stream webcam trực tiếp vào thẻ video để đạt 60 FPS từ phần cứng
  useEffect(() => {
    if (webcamVideoRef.current && webcamStream && isWebcamRunningHere) {
      webcamVideoRef.current.srcObject = webcamStream;
      webcamVideoRef.current.play().catch(() => {});
    }
    if (zoomVideoRef.current && webcamStream && isWebcamRunningHere && isZoomed) {
      zoomVideoRef.current.srcObject = webcamStream;
      zoomVideoRef.current.play().catch(() => {});
    }
  }, [webcamStream, isWebcamRunningHere, isZoomed]);

  // Vẽ bounding box cho Webcam (cả thẻ nhỏ và modal phóng to)
  useEffect(() => {
    if (!isWebcamRunningHere) return;
    drawBoxes(webcamCanvasRef.current, webcamDetections);
    if (isZoomed) {
      drawBoxes(zoomCanvasRef.current, webcamDetections);
    }
  }, [webcamDetections, isWebcamRunningHere, isZoomed, drawBoxes]);

  // Xử lý AI nhận diện cho video tải lên
  useEffect(() => {
    if (!hasLocalVideo) {
      setLocalDetections([]);
      return;
    }

    if (!sampleCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 480;
      sampleCanvasRef.current = c;
    }

    let isMounted = true;
    const interval = setInterval(async () => {
      const vid = localVideoRef.current;
      if (!vid || vid.paused || vid.ended || vid.readyState < 2 || isAnalyzingRef.current) {
        return;
      }

      isAnalyzingRef.current = true;
      try {
        const canvas = sampleCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(vid, 0, 0, 640, 480);
        await new Promise<void>((resolve) => {
          canvas.toBlob(async (blob) => {
            if (!blob || !isMounted) {
              resolve();
              return;
            }
            const formData = new FormData();
            formData.append('file', blob, 'video_frame.jpg');

            try {
              const res = await fetch(`${API_BASE}/webcam/${cam.id}/detect`, {
                method: 'POST',
                body: formData,
              });
              if (res.ok && isMounted) {
                const data = await res.json();
                if (data.detected_objects) {
                  setLocalDetections(data.detected_objects);
                }
              }
            } catch {
              // ignore
            } finally {
              resolve();
            }
          }, 'image/jpeg', 0.85);
        });
      } catch {
        // ignore
      } finally {
        isAnalyzingRef.current = false;
      }
    }, 250);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [hasLocalVideo, cam.id, cam.videoBlob]);

  // Vẽ bounding box cho Local Video (cả thẻ nhỏ và modal phóng to)
  useEffect(() => {
    if (!hasLocalVideo) return;
    drawBoxes(localCanvasRef.current, localDetections);
    if (isZoomed) {
      drawBoxes(zoomCanvasRef.current, localDetections);
    }
  }, [localDetections, hasLocalVideo, isZoomed, drawBoxes]);

  const toggleWebcam = () => {
    if (isWebcamActive) {
      stopWebcam();
    } else {
      startWebcam();
    }
  };

  return (
    <div className={styles.cameraCard + ' glass-panel'}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isWebcamRunningHere || hasLocalVideo ? '#22c55e' : '#6b7280',
            boxShadow: isWebcamRunningHere || hasLocalVideo ? '0 0 8px #22c55e' : 'none',
            flexShrink: 0
          }} />
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--on-surface)' }}>{cam.name}</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{cam.location}</span>
      </div>

      {/* Video Viewport */}
      <div className={styles.streamContainer}>
        {isWebcamRunningHere ? (
          <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
            {/* Native Hardware Video - 60 FPS */}
            <video
              ref={webcamVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Zero-Lag Canvas Overlay for Bounding Boxes */}
            <canvas
              ref={webcamCanvasRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
            />
            <div style={{
              position: 'absolute', bottom: '8px', left: '8px',
              background: 'rgba(34,197,94,0.9)', backdropFilter: 'blur(4px)',
              borderRadius: '6px', padding: '4px 10px',
              fontSize: '10px', fontWeight: 600, color: '#fff', zIndex: 3,
              display: 'flex', alignItems: 'center', gap: '5px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
              WEBCAM GPU AI 60 FPS
            </div>
          </div>
        ) : hasLocalVideo ? (
          <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
            <video
              ref={localVideoRef}
              src={cam.videoBlob}
              autoPlay
              loop
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <canvas
              ref={localCanvasRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
            />
            <div style={{
              position: 'absolute', bottom: '8px', left: '8px',
              background: localDetections.length > 0 ? 'rgba(34,197,94,0.9)' : 'rgba(59,130,246,0.9)', backdropFilter: 'blur(4px)',
              borderRadius: '6px', padding: '4px 10px',
              fontSize: '10px', fontWeight: 600, color: '#fff', zIndex: 3,
              display: 'flex', alignItems: 'center', gap: '5px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
              {localDetections.length > 0 ? 'VIDEO GPU AI GIÁM SÁT' : 'VIDEO ĐANG CHẠY'}
            </div>
          </div>
        ) : (
          /* Clean Camera OFF State */
          <div style={{
            position: 'absolute', inset: 0, background: 'var(--surface-low)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '12px', padding: '20px', textAlign: 'center'
          }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%', background: 'var(--surface-lowest)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--outline-variant)'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--text-secondary)', opacity: 0.7 }}>
                videocam_off
              </span>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '2px' }}>
                Camera đang tắt
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Bấm "Bật Webcam" để bắt đầu nhận diện an toàn qua AI
              </div>
            </div>
            {isThisCameraWebcam && (
              <button
                className="btn btn-primary"
                onClick={toggleWebcam}
                style={{ fontSize: '12px', padding: '6px 14px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>videocam</span>
                Bật Webcam Laptop
              </button>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--outline-variant)' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isThisCameraWebcam && (
            <button
              onClick={toggleWebcam}
              className="btn"
              style={{
                flex: 1, fontSize: '12px', padding: '6px 12px',
                background: isWebcamRunningHere ? 'var(--error)' : 'var(--primary)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {isWebcamRunningHere ? 'videocam_off' : 'videocam'}
              </span>
              {isWebcamRunningHere ? 'Tắt Webcam' : 'Bật Webcam'}
            </button>
          )}
          
          <label style={{
            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
            padding: '6px 12px', borderRadius: '6px', border: '1px dashed var(--outline)',
            fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--surface-low)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload</span>
            Tải video
            <input
              type="file"
              accept="video/mp4,video/webm"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadFile(cam.id, f);
              }}
            />
          </label>
          
          <button
            className="btn btn-outline"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={() => setIsZoomed(true)}
          >
            Phóng to
          </button>

          {!isThisCameraWebcam && (
            <button
              className="btn btn-danger"
              style={{ fontSize: '12px', padding: '6px 12px', background: 'var(--error)', color: '#fff' }}
              onClick={() => onDelete(cam.id)}
            >
              Xóa
            </button>
          )}
        </div>
      </div>

      {/* Zoom Modal - Full Screen Detail */}
      {isZoomed && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}
          onClick={() => setIsZoomed(false)}
        >
          <div
            style={{
              position: 'relative', width: '100%', maxWidth: '960px',
              background: '#111827', borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 20px', background: 'rgba(17, 24, 39, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: isWebcamRunningHere || hasLocalVideo ? '#22c55e' : '#6b7280',
                  boxShadow: isWebcamRunningHere || hasLocalVideo ? '0 0 10px #22c55e' : 'none'
                }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#f3f4f6' }}>{cam.name}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{cam.location}</div>
                </div>
              </div>
              
              <button
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px',
                  color: '#f3f4f6', padding: '6px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
                }}
                onClick={() => setIsZoomed(false)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                Đóng
              </button>
            </div>

            {/* Modal Video Viewport */}
            <div style={{ position: 'relative', width: '100%', height: '540px', background: '#000', overflow: 'hidden' }}>
              {isWebcamRunningHere ? (
                <>
                  <video
                    ref={zoomVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                  <canvas
                    ref={zoomCanvasRef}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
                  />
                  <div style={{
                    position: 'absolute', bottom: '12px', left: '12px',
                    background: 'rgba(34,197,94,0.9)', backdropFilter: 'blur(6px)',
                    borderRadius: '8px', padding: '6px 12px',
                    fontSize: '11px', fontWeight: 600, color: '#fff', zIndex: 3,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
                    WEBCAM GPU AI 60 FPS LIVE
                  </div>
                </>
              ) : hasLocalVideo ? (
                <>
                  <video
                    src={cam.videoBlob}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                  <canvas
                    ref={zoomCanvasRef}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
                  />
                  <div style={{
                    position: 'absolute', bottom: '12px', left: '12px',
                    background: localDetections.length > 0 ? 'rgba(34,197,94,0.9)' : 'rgba(59,130,246,0.9)', backdropFilter: 'blur(6px)',
                    borderRadius: '8px', padding: '6px 12px',
                    fontSize: '11px', fontWeight: 600, color: '#fff', zIndex: 3,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
                    {localDetections.length > 0 ? 'VIDEO GPU AI GIÁM SÁT' : 'VIDEO ĐANG CHẠY'}
                  </div>
                </>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: '10px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.5 }}>videocam_off</span>
                  <div>Camera đang tắt</div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
