import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ZoneDrawer.module.css';
import { createZone } from '@/services/api';
import type { Zone } from '@/services/api';

interface ZoneDrawerProps {
  cameraId: string;
  existingZones: Zone[];
  isDrawing: boolean;
  onClose: () => void;
  onZoneCreated: (newZone: Zone) => void;
}

const PRESET_COLORS = [
  { label: 'Đỏ (Nguy hiểm)', value: '#ef4444' },
  { label: 'Vàng cam (Cảnh báo)', value: '#f97316' },
  { label: 'Vàng (Lưu ý)', value: '#eab308' },
  { label: 'Xanh dương (Khu vực)', value: '#3b82f6' },
];

export const ZoneDrawer: React.FC<ZoneDrawerProps> = ({
  cameraId,
  existingZones,
  isDrawing,
  onClose,
  onZoneCreated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [currentMouse, setCurrentMouse] = useState<[number, number] | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneSeverity, setZoneSeverity] = useState('CRITICAL');
  const [zoneColor, setZoneColor] = useState('#ef4444');
  const [zoneDesc, setZoneDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Redraw canvas loop whenever points, mouse position, or existing zones change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // 1. Draw existing zones
    existingZones.forEach((z) => {
      if (!z.polygon_coords || z.polygon_coords.length < 3) return;

      const isNorm = z.polygon_coords.every(
        (pt) => pt[0] <= 1.0 && pt[1] <= 1.0
      );

      ctx.beginPath();
      z.polygon_coords.forEach(([px, py], i) => {
        const x = isNorm ? px * width : px;
        const y = isNorm ? py * height : py;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();

      const color = z.color || '#ef4444';
      ctx.fillStyle = `${color}33`; // 20% opacity
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw label
      const firstPt = z.polygon_coords[0];
      const lx = isNorm ? firstPt[0] * width : firstPt[0];
      const ly = isNorm ? firstPt[1] * height : firstPt[1];

      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(z.name, lx + 4, Math.max(14, ly - 4));
    });

    // 2. Draw currently drawing points and polygon
    if (points.length > 0) {
      ctx.beginPath();
      points.forEach(([px, py], i) => {
        const x = px * width;
        const y = py * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      if (currentMouse && points.length > 0) {
        ctx.lineTo(currentMouse[0], currentMouse[1]);
      }

      ctx.fillStyle = `${zoneColor}26`; // 15% opacity preview
      ctx.fill();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = zoneColor;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw vertices
      points.forEach(([px, py], idx) => {
        const x = px * width;
        const y = py * height;
        ctx.beginPath();
        ctx.arc(x, y, idx === 0 ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? '#22c55e' : zoneColor;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Label for first point
        if (idx === 0 && points.length >= 3) {
          ctx.font = '10px Inter, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('Đóng (Click)', x + 8, y - 6);
        }
      });
    }
  }, [points, currentMouse, existingZones, zoneColor]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Click on Canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (showSaveModal) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if clicking close to the first point to close polygon (when >= 3 points)
    if (points.length >= 3) {
      const firstX = points[0][0] * canvas.width;
      const firstY = points[0][1] * canvas.height;
      const dist = Math.hypot(clickX - firstX, clickY - firstY);

      if (dist < 20) {
        // Complete polygon
        setShowSaveModal(true);
        return;
      }
    }

    // Add normalized point (0.0 to 1.0)
    const normX = Math.max(0, Math.min(1, clickX / canvas.width));
    const normY = Math.max(0, Math.min(1, clickY / canvas.height));

    setPoints((prev) => [...prev, [normX, normY]]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (showSaveModal) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    setCurrentMouse([e.clientX - rect.left, e.clientY - rect.top]);
  };

  const handleUndo = () => {
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleComplete = () => {
    if (points.length >= 3) {
      setShowSaveModal(true);
    }
  };

  const handleCancel = () => {
    setPoints([]);
    setCurrentMouse(null);
    setShowSaveModal(false);
    onClose();
  };

  const handleSaveZone = async () => {
    if (points.length < 3) return;
    setIsSaving(true);
    try {
      const newZone = await createZone({
        camera_id: cameraId,
        name: zoneName.trim() || `Vùng cấm #${existingZones.length + 1}`,
        polygon_coords: points,
        severity: zoneSeverity,
        color: zoneColor,
        description: zoneDesc.trim() || undefined,
        is_active: true,
      });

      onZoneCreated(newZone);
      setPoints([]);
      setShowSaveModal(false);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu vùng cấm.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isDrawing) return null;

  return (
    <div className={styles.drawerOverlay}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
      />

      {/* Top Floating Control Bar */}
      <div className={styles.toolbar}>
        <div className={styles.info}>
          <span className={styles.badge}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px' }}
            >
              edit
            </span>
            CHẾ ĐỘ VẼ
          </span>
          <span>
            {points.length === 0
              ? 'Click vào màn hình để bắt đầu chấm điểm tạo vùng'
              : `Đã chấm ${points.length} điểm (Tối thiểu 3 điểm để hoàn tất)`}
          </span>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.btnAction}
            onClick={handleUndo}
            disabled={points.length === 0}
            title="Hoàn tác điểm vừa chấm"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '15px' }}
            >
              undo
            </span>
            Hoàn tác
          </button>

          <button
            className={`${styles.btnAction} ${styles.btnComplete}`}
            onClick={handleComplete}
            disabled={points.length < 3}
            title="Khép kín và lưu vùng cấm"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '15px' }}
            >
              check_circle
            </span>
            Hoàn tất ({points.length} điểm)
          </button>

          <button
            className={`${styles.btnAction} ${styles.btnCancel}`}
            onClick={handleCancel}
            title="Thoát chế độ vẽ"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '15px' }}
            >
              close
            </span>
            Hủy
          </button>
        </div>
      </div>

      {/* Save Zone Configuration Modal */}
      {showSaveModal && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalTitle}>
              <span
                className="material-symbols-outlined"
                style={{ color: zoneColor }}
              >
                security
              </span>
              Thiết lập vùng cấm mới
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Tên vùng cấm *</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Ví dụ: Khu vực hố móng, Cẩu tháp..."
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                autoFocus
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Mức độ nghiêm trọng</label>
              <select
                className={styles.select}
                value={zoneSeverity}
                onChange={(e) => setZoneSeverity(e.target.value)}
              >
                <option value="CRITICAL">CRITICAL (Nghiêm trọng - Còi & Cảnh báo đỏ)</option>
                <option value="MEDIUM">MEDIUM (Trung bình - Cảnh báo vàng)</option>
                <option value="LOW">LOW (Nhẹ - Ghi nhận nhật ký)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Màu hiển thị</label>
              <div className={styles.colorPicker}>
                {PRESET_COLORS.map((c) => (
                  <div
                    key={c.value}
                    className={`${styles.colorDot} ${
                      zoneColor === c.value ? styles.colorDotSelected : ''
                    }`}
                    style={{ background: c.value }}
                    onClick={() => setZoneColor(c.value)}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Mô tả ghi chú (tùy chọn)</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Vị trí ranh giới công trường..."
                value={zoneDesc}
                onChange={(e) => setZoneDesc(e.target.value)}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.btnAction}
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
              >
                Quay lại vẽ
              </button>
              <button
                className={`${styles.btnAction} ${styles.btnComplete}`}
                onClick={handleSaveZone}
                disabled={isSaving}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu vùng cấm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
