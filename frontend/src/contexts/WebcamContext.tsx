import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: [number, number, number, number]; // [xmin, ymin, xmax, ymax]
  is_violation: boolean;
}

interface WebcamContextType {
  isWebcamActive: boolean;
  webcamStream: MediaStream | null;
  detections: DetectedObject[];
  totalViolations: number;
  startWebcam: () => Promise<void>;
  stopWebcam: () => void;
  streamError: boolean;
  cameraId: string;
}

const WebcamContext = createContext<WebcamContextType | undefined>(undefined);

export function WebcamProvider({ children }: { children: React.ReactNode }) {
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [totalViolations, setTotalViolations] = useState<number>(0);
  const [streamError, setStreamError] = useState(false);
  const cameraId = '00000000-0000-0000-0000-000000000001';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<any>(null);
  const isUploadingRef = useRef<boolean>(false);
  const activeRef = useRef<boolean>(false);

  useEffect(() => {
    // Hidden video element for local frame sampling
    const video = document.createElement('video');
    video.style.display = 'none';
    video.muted = true;
    video.playsInline = true;
    document.body.appendChild(video);
    videoRef.current = video;

    // Single reusable canvas instance to avoid GC memory churn
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvasRef.current = canvas;

    return () => {
      stopWebcam();
      if (videoRef.current && document.body.contains(videoRef.current)) {
        document.body.removeChild(videoRef.current);
      }
    };
  }, []);

  const stopWebcam = () => {
    activeRef.current = false;
    setIsWebcamActive(false);
    setWebcamStream(null);
    setDetections([]);
    setTotalViolations(0);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Release hardware camera tracks completely
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
          track.enabled = false;
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startWebcam = async () => {
    try {
      setStreamError(false);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("Trình duyệt không hỗ trợ getUserMedia.");
        setStreamError(true);
        return;
      }

      // Stop any existing stream before creating a new one
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });

      streamRef.current = stream;
      setWebcamStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.warn("Webcam play warning:", e);
          }
        });
      }

      activeRef.current = true;
      setIsWebcamActive(true);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Sample AI frame every 250ms (4 FPS) -> very smooth with GPU acceleration
      intervalRef.current = setInterval(captureWebcamFrameAndDetect, 250);
    } catch (err) {
      console.warn("Không thể mở webcam:", err);
      setStreamError(true);
      stopWebcam();
    }
  };

  const captureWebcamFrameAndDetect = async () => {
    if (!activeRef.current || !videoRef.current || !streamRef.current || isUploadingRef.current) return;
    if (videoRef.current.readyState < 2) return;

    isUploadingRef.current = true;
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, 640, 480);

      await new Promise<void>((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob || !activeRef.current) {
            resolve();
            return;
          }
          const formData = new FormData();
          formData.append('file', blob, 'webcam.jpg');

          try {
            const res = await fetch(`${API_BASE}/webcam/${cameraId}/detect`, {
              method: 'POST',
              body: formData
            });

            if (res.ok && activeRef.current) {
              const data = await res.json();
              if (data.detected_objects) {
                setDetections(data.detected_objects);
                setTotalViolations(data.total_violations || 0);
              }
            }
          } catch (e) {
            // Silently ignore dropped frame
          } finally {
            resolve();
          }
        }, 'image/jpeg', 0.85);
      });
    } catch (e) {
      // Silently ignore
    } finally {
      isUploadingRef.current = false;
    }
  };

  return (
    <WebcamContext.Provider value={{
      isWebcamActive,
      webcamStream,
      detections,
      totalViolations,
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
