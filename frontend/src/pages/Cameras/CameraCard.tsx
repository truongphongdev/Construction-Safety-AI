import { useState, useEffect } from 'react';
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

export const DEMO_VIDEOS = [
  { label: '-- Chưa chọn video --', value: '' },
  { label: '[Demo 1] People on Construction Site', value: '6000215_People_Person_1280x720.mp4' },
  { label: '[Demo 2] Safety Monitoring Scene', value: '548283_Coronavirus_Covid_19_1920x1080.mp4' },
  { label: '[Demo 3] PPE Test Video', value: 'PPE_test.mp4' },
];

interface CameraCardProps {
  cam: CameraItem;
  onAssignVideo: (camId: string, videoName: string) => void;
  onUploadFile: (camId: string, file: File) => void;
  onDelete: (camId: string) => void;
}

export function CameraCard({ cam, onAssignVideo, onUploadFile, onDelete }: CameraCardProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [streamError, setStreamError] = useState(false);
  
  // Use global webcam state if this is the default webcam camera
  const { isWebcamActive, webcamFrame, startWebcam, stopWebcam, cameraId } = useWebcam();
  
  // Only allow webcam if this is the designated webcam ID
  const isThisCameraWebcam = cam.id === cameraId;
  const isWebcamRunningHere = isThisCameraWebcam && isWebcamActive;

  const mjpegUrl = `${API_BASE}/stream/${cam.id}${cam.videoName ? `?video_name=${encodeURIComponent(cam.videoName)}` : ''}`;

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
            width: '7px', height: '7px', borderRadius: '50%',
            background: isWebcamRunningHere ? '#22c55e' : (!streamError ? '#16a34a' : '#ef4444'),
            boxShadow: isWebcamRunningHere ? '0 0 6px #22c55e' : (!streamError ? '0 0 6px #16a34a' : 'none'),
            flexShrink: 0
          }} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{cam.name}</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{cam.location}</span>
      </div>

      {/* Video Viewport */}
      <div className={styles.streamContainer}>
        {isWebcamRunningHere ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Show annotated frame from backend */}
            {webcamFrame ? (
              <img
                src={webcamFrame}
                alt="Webcam AI"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0, background: '#000',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: '#fff', gap: '10px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary)', animation: 'pulse 1.5s infinite' }}>videocam</span>
                <span style={{ fontSize: '12px' }}>Đang khởi tạo webcam AI...</span>
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: '8px', left: '8px',
              background: 'rgba(34,197,94,0.85)', backdropFilter: 'blur(4px)',
              borderRadius: '6px', padding: '3px 8px',
              fontSize: '10px', fontWeight: 600, color: '#fff', zIndex: 3
            }}>
              WEBCAM ACTIVE
            </div>
          </div>
        ) : !streamError ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* MJPEG Stream */}
            <img
              src={mjpegUrl}
              alt={cam.name}
              className={styles.videoStream}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setStreamError(true)}
            />
            {/* AI Live Badge */}
            <div style={{
              position: 'absolute', bottom: '8px', left: '8px',
              background: 'rgba(16,185,129,0.85)', backdropFilter: 'blur(4px)',
              borderRadius: '6px', padding: '3px 8px',
              fontSize: '10px', fontWeight: 600, color: '#fff',
              display: 'flex', alignItems: 'center', gap: '4px', zIndex: 3
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
              AI LIVE (MJPEG)
            </div>
          </div>
        ) : (
          <div className={styles.streamPlaceholder} onClick={() => setStreamError(false)} style={{ cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#f87171' }}>
              videocam_off
            </span>
            <span style={{ fontSize: '12px', fontWeight: 500 }}>Không thể tải MJPEG Stream (Bấm thử lại)</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--outline-variant)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <select
            value={cam.videoName || ''}
            disabled={isWebcamRunningHere}
            onChange={(e) => {
              setStreamError(false);
              onAssignVideo(cam.id, e.target.value);
            }}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '12px',
              border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)'
            }}
          >
            {DEMO_VIDEOS.map(v => (
              <option key={v.value} value={v.value} style={{ background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}>{v.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isThisCameraWebcam && (
            <button
              onClick={toggleWebcam}
              className="btn"
              style={{
                flex: 1, fontSize: '12px', padding: '6px 10px',
                background: isWebcamRunningHere ? 'var(--error)' : 'var(--primary)',
                color: '#fff'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {isWebcamRunningHere ? 'videocam_off' : 'videocam'}
              </span>
              {isWebcamRunningHere ? 'Tắt Webcam' : '📸 Webcam'}
            </button>
          )}
          
          <label style={{
            display: isWebcamRunningHere ? 'none' : 'flex',
            alignItems: 'center', gap: '6px', cursor: 'pointer',
            padding: '5px 10px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.15)',
            fontSize: '12px', color: 'var(--text-secondary)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload</span>
            Nạp video file
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
            style={{ fontSize: '11px', padding: '5px 12px' }}
            onClick={() => setIsZoomed(true)}
          >
            Phóng to
          </button>
          <button
            className="btn btn-danger"
            style={{ fontSize: '11px', padding: '5px 12px', background: 'var(--error)', color: '#fff' }}
            onClick={() => onDelete(cam.id)}
          >
            Xóa
          </button>
        </div>
      </div>

      {/* Zoom Modal */}
      {isZoomed && createPortal(
        <div 
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px'
          }}
          onClick={() => setIsZoomed(false)}
        >
          <div 
            style={{
              position: 'relative', width: '100%', maxWidth: '1000px', background: 'var(--surface-lowest)',
              color: 'var(--on-surface)', borderRadius: '12px', padding: '24px', border: '1px solid var(--outline-variant)',
              boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: '16px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: 'var(--on-surface)', fontSize: '18px', fontWeight: 700 }}>
                {cam.name} — {isWebcamRunningHere ? 'Webcam AI' : 'Server-Side Stream'}
              </h3>
              <button 
                className="btn btn-outline" 
                style={{ padding: '6px 16px', fontSize: '13px' }}
                onClick={() => setIsZoomed(false)}
              >
                ✕ Đóng
              </button>
            </div>
            <div style={{ width: '100%', height: '540px', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
              <img 
                src={isWebcamRunningHere ? (webcamFrame || '') : mjpegUrl} 
                alt={cam.name} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
