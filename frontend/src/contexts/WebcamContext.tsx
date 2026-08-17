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
  const isUploadingRef = useRef<boolean>(false);
  
  useEffect(() => {
    // Create hidden video element for local stream capture
    const video = document.createElement('video');
    video.style.display = 'none';
    video.muted = true;
    video.playsInline = true;
    document.body.appendChild(video);
    videoRef.current = video;

    // Tự động khởi động camera máy tính mặc định khi vừa mở app
    startWebcam(true);

    return () => {
      stopWebcam();
      if (videoRef.current && document.body.contains(videoRef.current)) {
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

  const startWebcam = async (isAutoStart: boolean = false) => {
    try {
      setStreamError(false);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("Trình duyệt không hỗ trợ getUserMedia.");
        setStreamError(true);
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.warn("Webcam play warning:", e);
          }
        });
      }
      setIsWebcamActive(true);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(captureWebcamFrameAndUpload, 200);
    } catch (err) {
      console.warn("Không thể tự động mở webcam:", err);
      setStreamError(true);
      if (!isAutoStart) {
        alert("Không thể truy cập camera máy tính. Vui lòng kiểm tra quyền truy cập thiết bị trong trình duyệt.");
      }
      stopWebcam();
    }
  };

  const captureWebcamFrameAndUpload = async () => {
    if (!videoRef.current || !streamRef.current || isUploadingRef.current) return;
    if (videoRef.current.readyState < 2) return; // Wait until video has frame data
    isUploadingRef.current = true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      
      await new Promise<void>((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            resolve();
            return;
          }
          const formData = new FormData();
          formData.append('file', blob, 'webcam.jpg');

          try {
            const res = await fetch(`${API_BASE}/webcam/${cameraId}`, {
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
          } finally {
            resolve();
          }
        }, 'image/jpeg', 0.85);
      });
    } catch (e) {
      console.error("Lỗi capture frame:", e);
    } finally {
      isUploadingRef.current = false;
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
