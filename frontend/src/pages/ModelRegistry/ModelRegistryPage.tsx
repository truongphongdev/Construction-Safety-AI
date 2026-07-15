import { useState } from 'react';
import styles from './ModelRegistryPage.module.css';

interface RegistryModel {
  id: string;
  name: string;
  type: string;
  size: string;
  tasks: string[];
  deployed: boolean;
  accuracy: string;
  framework: string;
}

export default function ModelRegistryPage() {
  const [models, setModels] = useState<RegistryModel[]>([
    {
      id: '1',
      name: 'YOLOv8 Security Suite',
      type: 'Object Detection',
      size: '42.5 MB',
      tasks: ['Mũ bảo hộ', 'Áo phản quang', 'Xâm nhập'],
      deployed: true,
      accuracy: '98.2%',
      framework: 'PyTorch / ONNX'
    },
    {
      id: '2',
      name: 'YOLOv5 Fire Detector',
      type: 'Detection / Segmentation',
      size: '28.1 MB',
      tasks: ['Khói', 'Lửa', 'Nhiệt độ bất thường'],
      deployed: false,
      accuracy: '96.4%',
      framework: 'TensorRT'
    },
    {
      id: '3',
      name: 'PPE Classifier ResNet',
      type: 'Image Classification',
      size: '95.2 MB',
      tasks: ['Kính bảo hộ', 'Găng tay', 'Ủng bảo hộ'],
      deployed: false,
      accuracy: '94.8%',
      framework: 'ONNX Runtime'
    }
  ]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [newModelType, setNewModelType] = useState('Object Detection');
  const [newModelAcc, setNewModelAcc] = useState('95.0%');

  const handleDeploy = (modelId: string) => {
    const updated = models.map((m) => ({
      ...m,
      deployed: m.id === modelId
    }));
    setModels(updated);
    const matched = models.find(m => m.id === modelId);
    alert(`Đã kích hoạt triển khai diện rộng model: ${matched?.name}. Tất cả camera đã liên kết sẽ tự động nạp cấu hình mới.`);
  };

  const handleDelete = (modelId: string) => {
    const matched = models.find(m => m.id === modelId);
    if (matched?.deployed) {
      alert('Không thể xóa Model đang hoạt động (Active)! Vui lòng triển khai model khác trước.');
      return;
    }
    if (confirm(`Bạn có chắc muốn xóa model ${matched?.name} khỏi thư viện?`)) {
      setModels(models.filter(m => m.id !== modelId));
    }
  };

  const handleUploadModelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName) {
      alert('Vui lòng điền tên model');
      return;
    }

    const newModel: RegistryModel = {
      id: (models.length + 1).toString(),
      name: newModelName,
      type: newModelType,
      size: '35.4 MB',
      tasks: ['Phát hiện vật thể chung'],
      deployed: false,
      accuracy: newModelAcc,
      framework: 'ONNX Runtime'
    };

    setModels([...models, newModel]);
    setNewModelName('');
    setNewModelType('Object Detection');
    setNewModelAcc('95.0%');
    setShowUploadModal(false);
    alert('Tải lên và đăng ký model mới thành công!');
  };

  return (
    <div>
      {/* Upload Drop Zone */}
      <div 
        className={styles.uploadSection} 
        onClick={() => setShowUploadModal(true)}
      >
        <span className={`material-symbols-outlined ${styles.uploadIcon}`}>cloud_upload</span>
        <h3 className={styles.uploadTitle}>Nhấp vào để đăng ký Model AI mới</h3>
        <p className={styles.uploadDesc}>Hỗ trợ định dạng weights .onnx, .pt, .engine, .xml (Tối đa 200MB)</p>
      </div>

      <div className={styles.topBar}>
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Thư viện Model hiện tại ({models.length})</h3>
      </div>

      {/* Model Cards Grid */}
      <div className={styles.modelsGrid}>
        {models.map((model) => (
          <div key={model.id} className={`${styles.modelCard} glass-panel`}>
            <div className={styles.cardHeader}>
              <div className={styles.modelInfo}>
                <span className={styles.modelType}>{model.type}</span>
                <h4 className={styles.modelTitle}>{model.name}</h4>
              </div>
              
              <span className={`badge ${model.deployed ? 'badge-success' : 'badge-secondary'}`}>
                {model.deployed ? 'Active' : 'Standby'}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)', margin: '8px 0' }}>
              <div>Độ chính xác: <strong>{model.accuracy}</strong></div>
              <div>Môi trường chạy: <strong>{model.framework}</strong></div>
            </div>

            <div className={styles.tags}>
              {model.tasks.map((task, idx) => (
                <span key={idx} className={styles.tag}>{task}</span>
              ))}
            </div>

            <div className={styles.cardFooter}>
              <span className={styles.modelMeta}>Dung lượng: {model.size}</span>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                {!model.deployed ? (
                  <button 
                    className="btn btn-primary" 
                    style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                    onClick={() => handleDeploy(model.id)}
                  >
                    Deploy
                  </button>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 600, padding: '6px 12px' }}>Đang chạy</span>
                )}
                
                <button 
                  className="btn btn-outline" 
                  style={{ height: '32px', width: '32px', padding: 0 }}
                  onClick={() => handleDelete(model.id)}
                  aria-label="Xóa model"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Model Dialog */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{ padding: '24px', width: '400px', backgroundColor: 'var(--surface-lowest)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Tải lên weights & Đăng ký Model</h3>
            <form onSubmit={handleUploadModelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="input-group">
                <label className="input-label" htmlFor="modelName">Tên Model</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    id="modelName" 
                    className="input-field" 
                    placeholder="Ví dụ: YOLOv8-Safety-Vest" 
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    required
                    style={{ paddingLeft: '12px' }}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="modelType">Phân loại AI</label>
                <select 
                  id="modelType" 
                  className="input-field" 
                  value={newModelType} 
                  onChange={(e) => setNewModelType(e.target.value)}
                  style={{ paddingLeft: '12px', appearance: 'none' }}
                >
                  <option value="Object Detection">Object Detection</option>
                  <option value="Instance Segmentation">Instance Segmentation</option>
                  <option value="Image Classification">Image Classification</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="modelAcc">Độ chính xác kiểm thử (mAP)</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    id="modelAcc" 
                    className="input-field" 
                    placeholder="Ví dụ: 96.8%" 
                    value={newModelAcc}
                    onChange={(e) => setNewModelAcc(e.target.value)}
                    required
                    style={{ paddingLeft: '12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" style={{ height: '36px' }} onClick={() => setShowUploadModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ height: '36px' }}>
                  Đăng ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
