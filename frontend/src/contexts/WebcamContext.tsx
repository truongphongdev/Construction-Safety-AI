import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface WebcamContextType {
  isWebcamActive: boolean;
  webcamFrame: string | null;
  startWebcam: () => Promise<void>;
  stopWebcam: () => void;
  streamError: boolean;
  cameraId: string;
}

const WebcamContext = createContext<WebcamContextType | undefined>(undefined);

export function WebcamProvider({ children }: { children: React.ReactNode }) {
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamFrame, setWebcamFrame] = useState<string | null>(null);
  const [streamError, setStreamError] = useState(false);
  const cameraId = '00000000-0000-0000-0000-000000000001';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);
  
  useEffect(() => {
    // Create hidden video element for local stream capture
    const video = document.createElement('video');
    video.style.display = 'none';
    video.muted = true;
    video.playsInline = true;
    document.body.appendChild(video);
    videoRef.current = video;

    return () => {
      stopWebcam();
      if (videoRef.current) {
        document.body.removeChild(videoRef.current);
      }
    };
  }, []);

  const stopWebcam = () => {
    setIsWebcamActive(false);
    setWebcamFrame(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startWebcam = async () => {
    try {
      setStreamError(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error("Play error:", e));
      }
      setIsWebcamActive(true);

      intervalRef.current = setInterval(captureWebcamFrameAndUpload, 500);
    } catch (err) {
      console.error("Không thể mở webcam:", err);
      alert("Không thể truy cập camera máy tính. Vui lòng cấp quyền.");
      stopWebcam();
    }
  };

  const captureWebcamFrameAndUpload = async () => {
    if (!videoRef.current || !streamRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append('file', blob, 'webcam.jpg');

        try {
          const serverHost = API_BASE.replace('/api/v1', '');
          const res = await fetch(`${serverHost}/stream/webcam/${cameraId}`, {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            if (data.annotated_image) {
              setWebcamFrame(data.annotated_image);
            }
          }
        } catch (e) {
          console.error("Lỗi gửi frame webcam lên backend:", e);
        }
      }, 'image/jpeg', 0.8);
    } catch (e) {
      console.error("Lỗi capture frame:", e);
    }
  };

  return (
    <WebcamContext.Provider value={{
      isWebcamActive,
      webcamFrame,
      startWebcam,
      stopWebcam,
      streamError,
      cameraId
    }}>
      {children}
    </WebcamContext.Provider>
  );
}

export function useWebcam() {
  const context = useContext(WebcamContext);
  if (context === undefined) {
    throw new Error('useWebcam must be used within a WebcamProvider');
  }
  return context;
}
