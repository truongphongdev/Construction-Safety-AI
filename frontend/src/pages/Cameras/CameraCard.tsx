import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './CamerasPage.module.css';
import { useWebcam } from '@/contexts/WebcamContext';

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
  const [videoAIFrame, setVideoAIFrame] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const isAnalyzingRef = useRef<boolean>(false);
  
  // Global webcam state
  const { isWebcamActive, webcamFrame, startWebcam, stopWebcam, cameraId } = useWebcam();
  
  const isThisCameraWebcam = cam.id === cameraId;
  const isWebcamRunningHere = isThisCameraWebcam && isWebcamActive;
  const hasLocalVideo = Boolean(cam.videoBlob);

  // Xử lý AI nhận diện cho video tải lên
  useEffect(() => {
    if (!hasLocalVideo) {
      setVideoAIFrame(null);
      return;
    }

    let isMounted = true;
    const interval = setInterval(async () => {
      const vid = localVideoRef.current;
      if (!vid || vid.paused || vid.ended || vid.readyState < 2 || isAnalyzingRef.current) {
        return;
      }

      isAnalyzingRef.current = true;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(vid, 0, 0, 640, 480);
        await new Promise<void>((resolve) => {
          canvas.toBlob(async (blob) => {
            if (!blob) {
              resolve();
              return;
            }
            const formData = new FormData();
            formData.append('file', blob, 'video_frame.jpg');

            try {
              const res = await fetch(`${API_BASE}/webcam/${cam.id}`, {
                method: 'POST',
                body: formData,
              });
              if (res.ok && isMounted) {
                const data = await res.json();
                if (data.annotated_image) {
                  setVideoAIFrame(data.annotated_image);
                }
              }
            } catch (err) {
              // Silently ignore frame drops
            } finally {
              resolve();
            }
          }, 'image/jpeg', 0.85);
        });
      } catch {
        // Silently ignore
      } finally {
        isAnalyzingRef.current = false;
      }
    }, 250);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [hasLocalVideo, cam.id, cam.videoBlob]);

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
          <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
            {/* Show annotated frame from backend */}
            {webcamFrame ? (
              <img
                src={webcamFrame}
                alt="Webcam AI"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0, background: '#000',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: '#fff', gap: '10px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary)', animation: 'pulse 1.5s infinite' }}>videocam</span>
                <span style={{ fontSize: '12px' }}>Đang kết nối Webcam & AI...</span>
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: '8px', left: '8px',
              background: 'rgba(34,197,94,0.85)', backdropFilter: 'blur(4px)',
              borderRadius: '6px', padding: '4px 10px',
              fontSize: '10px', fontWeight: 600, color: '#fff', zIndex: 3,
              display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
              WEBCAM AI LIVE
            </div>
          </div>
        ) : hasLocalVideo ? (
          <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
            <video
              ref={localVideoRef}
              src={cam.videoBlob}
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                display: videoAIFrame ? 'none' : 'block'
              }}
            />
            {videoAIFrame && (
              <img
                src={videoAIFrame}
                alt="Video AI Live"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
            <div style={{
              position: 'absolute', bottom: '8px', left: '8px',
              background: videoAIFrame ? 'rgba(34,197,94,0.85)' : 'rgba(59,130,246,0.85)', backdropFilter: 'blur(4px)',
              borderRadius: '6px', padding: '4px 10px',
              fontSize: '10px', fontWeight: 600, color: '#fff', zIndex: 3,
              display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
              {videoAIFrame ? 'VIDEO AI GIÁM SÁT' : 'VIDEO ĐANG CHẠY'}
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

      {/* Zoom Modal */}
      {isZoomed && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px'
          }}
          onClick={() => setIsZoomed(false)}
        >
          <div style={{ position: 'relative', width: '100%', maxWidth: '880px' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#000', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--outline-variant)' }}>
              {isWebcamRunningHere && webcamFrame ? (
                <img src={webcamFrame} alt={cam.name} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }} />
              ) : hasLocalVideo ? (
                videoAIFrame ? (
                  <img src={videoAIFrame} alt={cam.name} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }} />
                ) : (
                  <video src={cam.videoBlob} autoPlay loop muted playsInline style={{ width: '100%', maxHeight: '80vh', display: 'block' }} />
                )
              ) : (
                <div style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  Camera đang tắt
                </div>
              )}
            </div>
            <button
              style={{
                position: 'absolute', top: '-40px', right: 0, background: 'transparent', border: 'none',
                color: '#fff', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
              }}
              onClick={() => setIsZoomed(false)}
            >
              <span className="material-symbols-outlined">close</span>
              <span style={{ fontSize: '14px' }}>Đóng</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
