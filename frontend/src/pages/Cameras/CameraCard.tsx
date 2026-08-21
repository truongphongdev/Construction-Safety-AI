import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './CamerasPage.module.css';
import { useWebcam } from '@/contexts/WebcamContext';
import type { DetectedObject } from '@/contexts/WebcamContext';
import { ZoneDrawer } from '@/components/ZoneDrawer';
import { fetchZones, deleteZone, toggleCameraFeatures } from '@/services/api';
import type { Zone } from '@/services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface CameraItem {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  ppe_enabled?: boolean;
  zone_enabled?: boolean;
  rtspUrl?: string;
  videoName?: string;
  videoBlob?: string;
}

interface CameraCardProps {
  cam: CameraItem;
  onAssignVideo?: (camId: string, videoName: string) => void;
  onUploadFile: (camId: string, file: File) => void;
  onRemoveVideo?: (camId: string) => void;
  onDelete: (camId: string) => void;
  onToggleUpdate?: (camId: string, ppe: boolean, zone: boolean) => void;
}

export function CameraCard({ cam, onUploadFile, onRemoveVideo, onDelete, onToggleUpdate }: CameraCardProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [localDetections, setLocalDetections] = useState<DetectedObject[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isDrawingZone, setIsDrawingZone] = useState(false);

  // Local feature toggles
  const [ppeOn, setPpeOn] = useState<boolean>(cam.ppe_enabled ?? true);
  const [zoneOn, setZoneOn] = useState<boolean>(cam.zone_enabled ?? true);
  
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const zoomVideoRef = useRef<HTMLVideoElement | null>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const isAnalyzingRef = useRef<boolean>(false);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Global webcam state
  const { 
    isWebcamActive, 
    webcamStream, 
    detections: webcamDetections, 
    startWebcam, 
    stopWebcam, 
    cameraId,
    setPpeEnabled: setWebcamPpe,
    setZoneEnabled: setWebcamZone
  } = useWebcam();
  
  const isThisCameraWebcam = cam.id === cameraId;
  const isWebcamRunningHere = isThisCameraWebcam && isWebcamActive;
  const hasLocalVideo = Boolean(cam.videoBlob);

  // Load zones for this camera
  useEffect(() => {
    let isMounted = true;
    fetchZones(cam.id).then((res) => {
      if (isMounted) setZones(res);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [cam.id]);

  // Sync toggles when prop changes
  useEffect(() => {
    if (cam.ppe_enabled !== undefined) setPpeOn(cam.ppe_enabled);
    if (cam.zone_enabled !== undefined) setZoneOn(cam.zone_enabled);
  }, [cam.ppe_enabled, cam.zone_enabled]);

  // Helper vẽ bounding box & Zone Polygons theo chuẩn màu & tinh gọn text
  const drawBoxesAndZones = useCallback((canvas: HTMLCanvasElement | null, detections: DetectedObject[]) => {
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

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Zones overlay
    if (zoneOn && zones.length > 0) {
      zones.forEach((z) => {
        if (!z.polygon_coords || z.polygon_coords.length < 3) return;

        const isNorm = z.polygon_coords.every((pt) => pt[0] <= 1.0 && pt[1] <= 1.0);

        ctx.beginPath();
        z.polygon_coords.forEach(([px, py], i) => {
          const x = isNorm ? px * width : px;
          const y = isNorm ? py * height : py;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();

        const color = z.color || '#ef4444';
        ctx.fillStyle = `${color}2e`; // ~18% opacity
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on top point
        const firstPt = z.polygon_coords[0];
        const lx = isNorm ? firstPt[0] * width : firstPt[0];
        const ly = isNorm ? firstPt[1] * height : firstPt[1];

        const zoneLabel = `⛔ VÙNG CẤM: ${z.name}`;
        ctx.font = 'bold 11px Inter, sans-serif';
        const metrics = ctx.measureText(zoneLabel);
        const tw = metrics.width + 12;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(lx, Math.max(2, ly - 20), tw, 18, 4) : ctx.rect(lx, Math.max(2, ly - 20), tw, 18);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(zoneLabel, lx + 6, Math.max(15, ly - 7));
      });
    }

    if (!detections || detections.length === 0) return;

    // Helper: Point in Polygon test
    const isPointInPolygon = (pt: [number, number], polygon: [number, number][]): boolean => {
      const [x, y] = pt;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    const scaleX = width / 640;
    const scaleY = height / 480;

    // Separate person detections and subpart detections
    interface PersonObject {
      bbox: [number, number, number, number];
      confidence: number;
      hasNoHelmet: boolean;
      hasHelmet: boolean;
      hasNoVest: boolean;
      hasVest: boolean;
      inZone: boolean;
      subparts: DetectedObject[];
    }

    const persons: PersonObject[] = [];
    const subparts: DetectedObject[] = [];

    detections.forEach(det => {
      const lbl = det.label.toLowerCase().trim();
      if (lbl === 'person' || lbl === 'worker' || lbl === 'human') {
        persons.push({
          bbox: det.bbox,
          confidence: det.confidence,
          hasNoHelmet: false,
          hasHelmet: false,
          hasNoVest: false,
          hasVest: false,
          inZone: false,
          subparts: []
        });
      } else {
        subparts.push(det);
      }
    });

    // Check Zone Intrusion for Persons (tính theo tọa độ điểm chân của đối tượng)
    if (zoneOn && zones.length > 0) {
      const scaledZones = zones.map(z => {
        const isNorm = z.polygon_coords.every(pt => pt[0] <= 1.0 && pt[1] <= 1.0);
        return {
          ...z,
          coords: z.polygon_coords.map(([px, py]) => [
            isNorm ? px * 640 : px,
            isNorm ? py * 480 : py
          ] as [number, number])
        };
      });

      persons.forEach(p => {
        const [xmin, , xmax, ymax] = p.bbox;
        const footPt: [number, number] = [(xmin + xmax) / 2, ymax];
        for (const sz of scaledZones) {
          if (isPointInPolygon(footPt, sz.coords)) {
            p.inZone = true;
            break;
          }
        }
      });
    }

    // Associate Subparts (Đầu/Mũ, Áo) with corresponding Person
    const assignedSubparts = new Set<DetectedObject>();

    subparts.forEach(sub => {
      const [sxmin, symin, sxmax, symax] = sub.bbox;
      const scx = (sxmin + sxmax) / 2;
      const scy = (symin + symax) / 2;

      // Find matching person containing subpart center
      let matchedPerson: PersonObject | null = null;
      let minPersonArea = Infinity;

      for (const p of persons) {
        const [pxmin, pymin, pxmax, pymax] = p.bbox;
        if (scx >= pxmin && scx <= pxmax && scy >= pymin && scy <= pymax) {
          const area = (pxmax - pxmin) * (pymax - pymin);
          if (area < minPersonArea) {
            minPersonArea = area;
            matchedPerson = p;
          }
        }
      }

      const cleanLabel = sub.label.toLowerCase().replace(/[-_ ]/g, '');

      if (matchedPerson) {
        matchedPerson.subparts.push(sub);
        assignedSubparts.add(sub);

        if (cleanLabel.includes('nohelmet') || cleanLabel.includes('nohardhat')) {
          matchedPerson.hasNoHelmet = true;
        } else if (cleanLabel.includes('helmet') || cleanLabel.includes('hardhat')) {
          matchedPerson.hasHelmet = true;
        }

        if (cleanLabel.includes('novest') || cleanLabel.includes('nosafetyvest')) {
          matchedPerson.hasNoVest = true;
        } else if (cleanLabel.includes('vest')) {
          matchedPerson.hasVest = true;
        }
      }
    });

    // 2. Draw Person Bounding Boxes with 3-Color Convention
    // - Đỏ: Xâm nhập vùng cấm
    // - Vàng: Vi phạm không đội mũ
    // - Xanh lá: Mặc đầy đủ đồ bảo hộ / an toàn
    persons.forEach(p => {
      const [xmin, ymin, xmax, ymax] = p.bbox;
      const x = xmin * scaleX;
      const y = ymin * scaleY;
      const w = (xmax - xmin) * scaleX;
      const h = (ymax - ymin) * scaleY;

      let strokeColor = '#22c55e'; // Xanh lá mặc định (Đầy đủ bảo hộ)
      let bgColor = 'rgba(34, 197, 94, 0.92)';
      let labelText = '✓ ĐỦ BẢO HỘ';

      if (p.inZone) {
        // Vi phạm vùng cấm: Màu ĐỎ (ưu tiên cao nhất)
        strokeColor = '#ef4444';
        bgColor = 'rgba(239, 68, 68, 0.95)';
        labelText = p.hasNoHelmet ? '⛔ VÙNG CẤM • THIẾU MŨ' : '⛔ VÙNG CẤM';
      } else if (p.hasNoHelmet) {
        // Vi phạm không đội mũ: Màu VÀNG
        strokeColor = '#eab308';
        bgColor = 'rgba(234, 179, 8, 0.95)';
        labelText = '⚠️ THIẾU MŨ';
      } else if (p.hasNoVest) {
        // Cảnh báo thiếu áo nếu có
        strokeColor = '#f59e0b';
        bgColor = 'rgba(245, 158, 11, 0.92)';
        labelText = '⚠️ THIẾU ÁO BH';
      }

      // Khung bao Person (bo góc 5px)
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = strokeColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, 5);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.stroke();

      // Nhãn Person chính (gọn gàng, thanh lịch)
      ctx.font = 'bold 11px Inter, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width + 12;
      const textHeight = 19;
      const tagY = Math.max(0, y - textHeight - 2);

      ctx.fillStyle = bgColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, tagY, textWidth, textHeight, 4);
      } else {
        ctx.rect(x, tagY, textWidth, textHeight);
      }
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x + 6, tagY + 14);
    });

    // 3. Draw Subparts (Đầu & Áo) with Compact, Refined Mini-Tags
    // Giảm bớt lượng text, chỉ vẽ khung mảnh tinh tế và tag mini không che khuất màn hình
    subparts.forEach(sub => {
      const [xmin, ymin, xmax, ymax] = sub.bbox;
      const x = xmin * scaleX;
      const y = ymin * scaleY;
      const w = (xmax - xmin) * scaleX;
      const h = (ymax - ymin) * scaleY;

      const cleanLabel = sub.label.toLowerCase().replace(/[-_ ]/g, '');
      let strokeColor = '#22c55e';
      let tagBg = 'rgba(34, 197, 94, 0.85)';
      let tagText = 'Mũ BH';
      let isDashed = false;

      if (cleanLabel.includes('nohelmet') || cleanLabel.includes('nohardhat')) {
        strokeColor = '#eab308';
        tagBg = 'rgba(234, 179, 8, 0.9)';
        tagText = 'Thiếu mũ';
        isDashed = true;
      } else if (cleanLabel.includes('helmet') || cleanLabel.includes('hardhat')) {
        strokeColor = '#22c55e';
        tagBg = 'rgba(34, 197, 94, 0.85)';
        tagText = 'Mũ BH';
      } else if (cleanLabel.includes('novest') || cleanLabel.includes('nosafetyvest')) {
        strokeColor = '#f59e0b';
        tagBg = 'rgba(245, 158, 11, 0.85)';
        tagText = 'Thiếu áo';
        isDashed = true;
      } else if (cleanLabel.includes('vest')) {
        strokeColor = '#22c55e';
        tagBg = 'rgba(34, 197, 94, 0.85)';
        tagText = 'Áo BH';
      } else {
        tagText = sub.label;
      }

      // Khung viền mảnh thanh lịch (1.5px) cho bộ phận cụ thể
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = strokeColor;
      if (isDashed) {
        ctx.setLineDash([4, 3]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, 4);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Mini-Tag siêu tinh gọn ở góc trên của bộ phận
      ctx.font = 'bold 9px Inter, sans-serif';
      const miniMetrics = ctx.measureText(tagText);
      const miniWidth = miniMetrics.width + 8;
      const miniHeight = 14;
      const miniY = Math.max(0, y - miniHeight - 1);

      ctx.fillStyle = tagBg;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, miniY, miniWidth, miniHeight, 3);
      } else {
        ctx.rect(x, miniY, miniWidth, miniHeight);
      }
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(tagText, x + 4, miniY + 10);
    });
  }, [zoneOn, zones]);

  // Gán stream webcam trực tiếp vào thẻ video
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

  // Vẽ bounding box & zones cho Webcam
  useEffect(() => {
    if (!isWebcamRunningHere) return;
    drawBoxesAndZones(webcamCanvasRef.current, webcamDetections);
    if (isZoomed) {
      drawBoxesAndZones(zoomCanvasRef.current, webcamDetections);
    }
  }, [webcamDetections, isWebcamRunningHere, isZoomed, drawBoxesAndZones]);

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
              const url = `${API_BASE}/webcam/${cam.id}/detect?ppe_enabled=${ppeOn}&zone_enabled=${zoneOn}`;
              const res = await fetch(url, {
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
  }, [hasLocalVideo, cam.id, cam.videoBlob, ppeOn, zoneOn]);

  // Vẽ bounding box & zones cho Local Video
  useEffect(() => {
    if (!hasLocalVideo) return;
    drawBoxesAndZones(localCanvasRef.current, localDetections);
    if (isZoomed) {
      drawBoxesAndZones(zoomCanvasRef.current, localDetections);
    }
  }, [localDetections, hasLocalVideo, isZoomed, drawBoxesAndZones]);

  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  const toggleWebcam = () => {
    if (isWebcamActive) {
      stopWebcam();
    } else {
      startWebcam();
    }
  };

  const toggleVideoPlay = () => {
    const nextVal = !isVideoPlaying;
    setIsVideoPlaying(nextVal);
    if (localVideoRef.current) {
      if (nextVal) localVideoRef.current.play().catch(() => {});
      else localVideoRef.current.pause();
    }
    if (zoomVideoRef.current) {
      if (nextVal) zoomVideoRef.current.play().catch(() => {});
      else zoomVideoRef.current.pause();
    }
  };

  // Toggle Features Handler
  const handleTogglePpe = async () => {
    const nextVal = !ppeOn;
    setPpeOn(nextVal);
    if (isThisCameraWebcam) {
      setWebcamPpe(nextVal);
    }
    try {
      await toggleCameraFeatures(cam.id, { ppe_enabled: nextVal });
      if (onToggleUpdate) onToggleUpdate(cam.id, nextVal, zoneOn);
    } catch {
      // ignore
    }
  };

  const handleToggleZone = async () => {
    const nextVal = !zoneOn;
    setZoneOn(nextVal);
    if (isThisCameraWebcam) {
      setWebcamZone(nextVal);
    }
    try {
      await toggleCameraFeatures(cam.id, { zone_enabled: nextVal });
      if (onToggleUpdate) onToggleUpdate(cam.id, ppeOn, nextVal);
    } catch {
      // ignore
    }
  };

  // Auto-Zoom on Draw Zone Trigger
  const handleTriggerDrawZone = () => {
    setIsZoomed(true);
    setIsDrawingZone(true);
  };

  const handleDeleteZone = async (zoneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setZones(prev => prev.filter(z => z.id !== zoneId));
    try {
      await deleteZone(zoneId);
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.cameraCard + ' glass-panel'}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px 8px' }}>
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
            <video
              ref={webcamVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
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
              WEBCAM GPU AI 60 FPS {zones.length > 0 && `• ${zones.length} VÙNG`}
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
              {localDetections.length > 0 ? 'VIDEO GPU AI GIÁM SÁT' : 'VIDEO ĐANG CHẠY'} {zones.length > 0 && `• ${zones.length} VÙNG`}
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
                style={{ fontSize: '12px', padding: '6px 16px', borderRadius: '9999px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>videocam</span>
                Bật Webcam Laptop
              </button>
            )}
          </div>
        )}
      </div>

      {/* Zone List Bar (if any zones created) */}
      {zones.length > 0 && (
        <div className={styles.zoneListBar}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '10px' }}>Vùng cấm:</span>
          {zones.map((z) => (
            <span 
              key={z.id} 
              className={styles.zoneChip}
              style={{ background: `${z.color || '#ef4444'}` }}
            >
              {z.name}
              <button 
                className={styles.zoneDeleteBtn}
                onClick={(e) => handleDeleteZone(z.id, e)}
                title="Xóa vùng cấm này"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>close</span>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Modern Minimalist Capsule Dock (Single Row) */}
      <div className={styles.capsuleDock}>
        {/* Left: Pill Toggle Switches */}
        <div className={styles.pillToggleGroup}>
          {/* Nút Bật/Tắt Webcam Laptop */}
          {isThisCameraWebcam && (
            <button
              className={`${styles.pillToggle} ${isWebcamRunningHere ? styles.pillToggleWebcamActive : styles.pillToggleInactive}`}
              onClick={toggleWebcam}
              title={isWebcamRunningHere ? 'Webcam đang BẬT. Bấm để TẮT Webcam' : 'Webcam đang TẮT. Bấm để BẬT Webcam'}
            >
              <span className={`${styles.ledDot} ${isWebcamRunningHere ? styles.ledGreen : styles.ledOff}`} />
              <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '-2px' }}>
                {isWebcamRunningHere ? 'videocam' : 'videocam_off'}
              </span>
              {isWebcamRunningHere ? 'TẮT CAM' : 'BẬT CAM'}
            </button>
          )}

          {/* Nút Tạm dừng / Phát Video đã tải lên */}
          {hasLocalVideo && (
            <button
              className={`${styles.pillToggle} ${isVideoPlaying ? styles.pillToggleVideoActive : styles.pillToggleInactive}`}
              onClick={toggleVideoPlay}
              title={isVideoPlaying ? 'Video đang PHÁT. Bấm để TẠM DỪNG' : 'Video đang DỪNG. Bấm để PHÁT TIẾP'}
            >
              <span className={`${styles.ledDot} ${isVideoPlaying ? styles.ledGreen : styles.ledOff}`} />
              <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '-2px' }}>
                {isVideoPlaying ? 'pause' : 'play_arrow'}
              </span>
              {isVideoPlaying ? 'DỪNG' : 'PHÁT'}
            </button>
          )}

          <button
            className={`${styles.pillToggle} ${ppeOn ? styles.pillTogglePpeActive : styles.pillToggleInactive}`}
            onClick={handleTogglePpe}
            title={ppeOn ? 'Đang bật nhận diện PPE. Bấm để tắt' : 'Đang tắt nhận diện PPE. Bấm để bật'}
          >
            <span className={`${styles.ledDot} ${ppeOn ? styles.ledGreen : styles.ledOff}`} />
            PPE
          </button>

          <button
            className={`${styles.pillToggle} ${zoneOn ? styles.pillToggleZoneActive : styles.pillToggleInactive}`}
            onClick={handleToggleZone}
            title={zoneOn ? 'Đang bật giám sát Vùng cấm. Bấm để tắt' : 'Đang tắt giám sát Vùng cấm. Bấm để bật'}
          >
            <span className={`${styles.ledDot} ${zoneOn ? styles.ledRed : styles.ledOff}`} />
            ZONE
          </button>
        </div>

        {/* Right: Streamlined Actions */}
        <div className={styles.actionPillGroup}>
          {/* Vẽ vùng cấm -> Auto-Zoom on Draw */}
          <button
            className={styles.btnDrawAction}
            onClick={handleTriggerDrawZone}
            title="Tự động phóng to để vẽ vùng cấm bằng chuột"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              draw
            </span>
            Vẽ vùng cấm
          </button>

          {/* Upload video file icon */}
          <label 
            className={styles.btnIconAction}
            style={{ cursor: 'pointer', margin: 0 }}
            title="Tải video từ máy tính"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload</span>
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

          {/* Remove uploaded video button */}
          {hasLocalVideo && onRemoveVideo && (
            <button
              className={`${styles.btnIconAction} ${styles.btnIconDanger}`}
              onClick={() => onRemoveVideo(cam.id)}
              title="Gỡ bỏ video đã tải lên"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                videocam_off
              </span>
            </button>
          )}
          
          {/* Zoom icon */}
          <button
            className={styles.btnIconAction}
            onClick={() => {
              setIsZoomed(true);
              setIsDrawingZone(false);
            }}
            title="Phóng to khung nhìn camera"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              fullscreen
            </span>
          </button>

          {!isThisCameraWebcam && (
            <button
              className={`${styles.btnIconAction} ${styles.btnIconDanger}`}
              onClick={() => onDelete(cam.id)}
              title="Xóa camera"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                delete
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Zoom Modal - Clean Light/White Theme Background */}
      {isZoomed && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, 
            background: 'rgba(15, 23, 42, 0.45)', 
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            zIndex: 1000, padding: '20px'
          }}
          onClick={() => {
            setIsZoomed(false);
            setIsDrawingZone(false);
          }}
        >
          <div
            className={styles.zoomWhiteCard}
            onClick={e => e.stopPropagation()}
          >
            {/* Clean White Modal Header */}
            <div className={styles.zoomWhiteHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: isWebcamRunningHere || hasLocalVideo ? '#16a34a' : '#9ca3af',
                  boxShadow: isWebcamRunningHere || hasLocalVideo ? '0 0 8px #16a34a' : 'none'
                }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{cam.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{cam.location}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Modal Toggles */}
                <div className={styles.pillToggleGroup}>
                  {isThisCameraWebcam && (
                    <button
                      className={`${styles.pillToggle} ${isWebcamRunningHere ? styles.pillToggleWebcamActive : styles.pillToggleInactive}`}
                      onClick={toggleWebcam}
                      title={isWebcamRunningHere ? 'Tắt Webcam Laptop' : 'Bật Webcam Laptop'}
                    >
                      <span className={`${styles.ledDot} ${isWebcamRunningHere ? styles.ledGreen : styles.ledOff}`} />
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '-2px' }}>
                        {isWebcamRunningHere ? 'videocam' : 'videocam_off'}
                      </span>
                      {isWebcamRunningHere ? 'TẮT CAM' : 'BẬT CAM'}
                    </button>
                  )}

                  {hasLocalVideo && (
                    <button
                      className={`${styles.pillToggle} ${isVideoPlaying ? styles.pillToggleVideoActive : styles.pillToggleInactive}`}
                      onClick={toggleVideoPlay}
                      title={isVideoPlaying ? 'Tạm dừng Video' : 'Tiếp tục phát'}
                    >
                      <span className={`${styles.ledDot} ${isVideoPlaying ? styles.ledGreen : styles.ledOff}`} />
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '-2px' }}>
                        {isVideoPlaying ? 'pause' : 'play_arrow'}
                      </span>
                      {isVideoPlaying ? 'DỪNG' : 'PHÁT'}
                    </button>
                  )}

                  <button
                    className={`${styles.pillToggle} ${ppeOn ? styles.pillTogglePpeActive : styles.pillToggleInactive}`}
                    onClick={handleTogglePpe}
                  >
                    <span className={`${styles.ledDot} ${ppeOn ? styles.ledGreen : styles.ledOff}`} />
                    PPE
                  </button>
                  <button
                    className={`${styles.pillToggle} ${zoneOn ? styles.pillToggleZoneActive : styles.pillToggleInactive}`}
                    onClick={handleToggleZone}
                  >
                    <span className={`${styles.ledDot} ${zoneOn ? styles.ledRed : styles.ledOff}`} />
                    ZONE
                  </button>
                </div>

                {/* Draw Mode Switch in Modal */}
                <button
                  className={styles.btnDrawAction}
                  onClick={() => setIsDrawingZone(prev => !prev)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    {isDrawingZone ? 'edit_off' : 'draw'}
                  </span>
                  {isDrawingZone ? 'Đang vẽ...' : 'Vẽ vùng cấm'}
                </button>

                <button
                  className={styles.zoomWhiteCloseBtn}
                  onClick={() => {
                    setIsZoomed(false);
                    setIsDrawingZone(false);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  Đóng
                </button>
              </div>
            </div>

            {/* Modal Video Viewport with Drawing Canvas */}
            <div style={{ position: 'relative', width: '100%', height: '560px', background: '#0b0f19', overflow: 'hidden' }}>
              {/* Zone Drawer inside Zoom Viewport */}
              <ZoneDrawer
                cameraId={cam.id}
                existingZones={zones}
                isDrawing={isDrawingZone}
                onClose={() => setIsDrawingZone(false)}
                onZoneCreated={(newZ) => setZones(prev => [...prev, newZ])}
              />

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
                    background: 'rgba(22,163,74,0.9)', backdropFilter: 'blur(6px)',
                    borderRadius: '8px', padding: '6px 12px',
                    fontSize: '11px', fontWeight: 600, color: '#fff', zIndex: 3,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
                    WEBCAM GPU AI 60 FPS LIVE {zones.length > 0 && `• ${zones.length} VÙNG CẤM`}
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
                    background: localDetections.length > 0 ? 'rgba(22,163,74,0.9)' : 'rgba(37,99,235,0.9)', backdropFilter: 'blur(6px)',
                    borderRadius: '8px', padding: '6px 12px',
                    fontSize: '11px', fontWeight: 600, color: '#fff', zIndex: 3,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
                    {localDetections.length > 0 ? 'VIDEO GPU AI GIÁM SÁT' : 'VIDEO ĐANG CHẠY'} {zones.length > 0 && `• ${zones.length} VÙNG CẤM`}
                  </div>
                </>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '10px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.5 }}>videocam_off</span>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>Camera đang tắt</div>
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
