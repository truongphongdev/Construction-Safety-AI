import React, { useState, useEffect } from 'react';
import styles from './CamerasPage.module.css';
import { fetchCameras, createCamera, deleteCamera } from '../../services';
import type { Camera as ApiCamera } from '../../services';
import { CameraCard } from './CameraCard';
import type { CameraItem } from './CameraCard';

const LAPTOP_WEBCAM_ID = '00000000-0000-0000-0000-000000000001';

export default function CamerasPage() {
  const [cameras, setCameras] = useState<CameraItem[]>([
    { 
      id: LAPTOP_WEBCAM_ID, 
      name: 'Camera 01 - Webcam Laptop', 
      location: 'Webcam Laptop', 
      status: 'online' 
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newCamName, setNewCamName] = useState('');
  const [newCamLoc, setNewCamLoc] = useState('');
  const [newRtspUrl, setNewRtspUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Helper to update cameras state
  const updateCamerasState = (updater: (prev: CameraItem[]) => CameraItem[]) => {
    setCameras(prev => {
      const next = updater(prev);
      const assignments = next.map(c => ({ id: c.id, videoName: c.videoName, videoBlob: c.videoBlob }));
      localStorage.setItem('camera_video_assignments', JSON.stringify(assignments));
      return next;
    });
  };

  useEffect(() => {
    let isMounted = true;

    const loadCameras = async () => {
      try {
        const apiCams = await fetchCameras();
        if (isMounted) {
          if (apiCams && apiCams.length > 0) {
            const mappedCams = apiCams.map((c: ApiCamera) => ({
              id: c.id,
              name: c.name || 'Camera 01 - Webcam Laptop',
              location: c.location || c.location_desc || 'Webcam Laptop',
              status: 'online' as const,
              rtspUrl: c.rtsp_url || c.ip_address,
            }));
            setCameras(mappedCams);
          } else {
            // Mặc định luôn có camera laptop
            setCameras([{
              id: LAPTOP_WEBCAM_ID,
              name: 'Camera 01 - Webcam Laptop',
              location: 'Webcam Laptop',
              status: 'online'
            }]);
          }
        }
      } catch {
        if (isMounted) {
          setCameras([{
            id: LAPTOP_WEBCAM_ID,
            name: 'Camera 01 - Webcam Laptop',
            location: 'Webcam Laptop',
            status: 'online'
          }]);
        }
      }
    };

    // Xóa các camera rác đã lưu trong localStorage cũ nếu có
    localStorage.removeItem('camera_video_assignments');

    loadCameras();
    return () => { isMounted = false; };
  }, []);

  const validateVideoFile = (file: File): boolean => {
    const allowedExtensions = ['.mp4', '.webm'];
    const maxSizeBytes = 200 * 1024 * 1024; // 200 MB

    const fileName = file.name.toLowerCase();
    const hasValidExt = allowedExtensions.some(ext => fileName.endsWith(ext));
    if (!hasValidExt) {
      alert('Chỉ hỗ trợ file video định dạng .mp4 hoặc .webm');
      return false;
    }

    if (file.size > maxSizeBytes) {
      alert('Dung lượng file vượt quá giới hạn cho phép (tối đa 200MB)');
      return false;
    }

    return true;
  };

  const handleAssignVideo = (camId: string, videoName: string) => {
    updateCamerasState(prev => prev.map(c => c.id === camId ? { ...c, videoName, videoBlob: undefined } : c));
  };

  const handleUploadFile = (camId: string, file: File) => {
    if (!validateVideoFile(file)) return;
    const blobUrl = URL.createObjectURL(file);
    updateCamerasState(prev => prev.map(c => c.id === camId ? { ...c, videoBlob: blobUrl, videoName: undefined } : c));
  };

  const handleDeleteCamera = async (cameraId: string) => {
    if (cameraId === LAPTOP_WEBCAM_ID) {
      alert('Không thể xóa Camera mặc định của Laptop!');
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn xóa camera này không?')) return;
    try {
      await deleteCamera(cameraId);
      updateCamerasState(prev => prev.filter(c => c.id !== cameraId));
    } catch (err: any) {
      alert('Lỗi khi xóa camera: ' + err.message);
    }
  };

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamName) return;

    try {
      const created = await createCamera({
        name: newCamName,
        location_desc: newCamLoc || 'Công trường',
        ip_address: newRtspUrl || '127.0.0.1',
        status: 'ACTIVE' as any
      });

      const newCam: CameraItem = {
        id: created.id,
        name: created.name,
        location: created.location_desc || newCamLoc || 'Công trường',
        status: 'online',
        rtspUrl: created.ip_address || newRtspUrl || undefined,
        videoBlob: uploadedFile ? URL.createObjectURL(uploadedFile) : undefined,
      };

      updateCamerasState(prev => [...prev, newCam]);
    } catch (err) {
      console.error('Không thể lưu camera mới vào DB:', err);
      const fallbackId = `00000000-0000-0000-0000-${String(Date.now()).padStart(12, '0').slice(-12)}`;
      const newCam: CameraItem = {
        id: fallbackId,
        name: newCamName,
        location: newCamLoc || 'Công trường',
        status: 'online',
        rtspUrl: newRtspUrl || undefined,
        videoBlob: uploadedFile ? URL.createObjectURL(uploadedFile) : undefined,
      };
      updateCamerasState(prev => [...prev, newCam]);
    }

    setShowAddModal(false);
    setNewCamName(''); setNewCamLoc(''); setNewRtspUrl('');
    setUploadedFile(null);
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Quản lý Camera Giám sát</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
            Giám sát trực tiếp qua Webcam Laptop với mô hình AI YOLOv8 nhận diện đồ bảo hộ thời gian thực.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined">add_a_photo</span>
          Thêm Camera Mới
        </button>
      </div>

      {/* Camera Grid */}
      <div className={styles.camerasGrid}>
        {cameras.map(cam => (
          <CameraCard
            key={cam.id}
            cam={cam}
            onAssignVideo={handleAssignVideo}
            onUploadFile={handleUploadFile}
            onDelete={handleDeleteCamera}
          />
        ))}
      </div>

      {/* Add Camera Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '28px', background: 'var(--surface-lowest)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', color: 'var(--on-surface)' }}>Thêm Camera Mới</h3>
            <form onSubmit={handleAddCamera}>
              {[
                { label: 'Tên Camera *', value: newCamName, setter: setNewCamName, placeholder: 'Cam 02 - Cổng chính' },
                { label: 'Địa điểm', value: newCamLoc, setter: setNewCamLoc, placeholder: 'Khu vực thi công' },
                { label: 'RTSP URL (IP Camera)', value: newRtspUrl, setter: setNewRtspUrl, placeholder: 'rtsp://192.168.1.xxx/live' },
              ].map(({ label, value, setter, placeholder }) => (
                <div key={label} style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: 'var(--on-surface-variant)' }}>{label}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--outline-variant)', background: 'var(--surface-low)', color: 'var(--on-surface)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: 'var(--on-surface-variant)' }}>Hoặc Tải lên File Video cục bộ</label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                  padding: '8px 12px', borderRadius: '6px', border: '1px dashed var(--outline)',
                  fontSize: '13px', color: 'var(--on-surface-variant)', background: 'var(--surface-low)',
                  justifyContent: 'center', transition: 'all 0.2s'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload</span>
                  {uploadedFile ? uploadedFile.name : 'Chọn video file (MP4, WebM)...'}
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (f && validateVideoFile(f)) {
                        setUploadedFile(f);
                      } else {
                        e.target.value = '';
                        setUploadedFile(null);
                      }
                    }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={!newCamName}>Thêm Camera</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
