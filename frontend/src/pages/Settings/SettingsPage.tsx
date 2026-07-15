import { useState } from 'react';
import useTheme from '@/hooks/useTheme';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [autoRecord, setAutoRecord] = useState(true);
  const [retentionDays, setRetentionDays] = useState(30);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Đã lưu cấu hình chung của hệ thống VisionGuard AI.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Visual Themes Selector */}
      <div className={`${styles.card} glass-panel`}>
        <div className={styles.title}>
          <span className="material-symbols-outlined text-primary">palette</span>
          Giao diện & Chủ đề (Theme System)
        </div>
        <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
          Chọn phong cách hiển thị phù hợp với điều kiện ánh sáng của trung tâm vận hành.
        </p>

        <div className={styles.themeSelector}>
          <div 
            className={`${styles.themeOption} ${theme === 'light' ? styles.themeOptionActive : ''}`}
            onClick={() => setTheme('light')}
          >
            <span className="material-symbols-outlined text-3xl" style={{ color: theme === 'light' ? 'var(--primary)' : 'inherit' }}>light_mode</span>
            <div className={styles.themeName}>Precision Lens</div>
            <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Light Mode (Corporate)</span>
          </div>

          <div 
            className={`${styles.themeOption} ${theme === 'dark' ? styles.themeOptionActive : ''}`}
            onClick={() => setTheme('dark')}
          >
            <span className="material-symbols-outlined text-3xl" style={{ color: theme === 'dark' ? 'var(--primary)' : 'inherit' }}>dark_mode</span>
            <div className={styles.themeName}>Glacier Glass</div>
            <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Dark Mode (Glassmorphic)</span>
          </div>
        </div>
      </div>

      {/* Notifications configuration */}
      <div className={`${styles.card} glass-panel`}>
        <div className={styles.title}>
          <span className="material-symbols-outlined text-primary">notifications</span>
          Cấu hình Cảnh báo & Thông báo
        </div>

        <div className={styles.settingRow}>
          <div>
            <div className={styles.settingLabel}>Email báo cáo vi phạm hàng ngày</div>
            <div className={styles.settingDesc}>Tự động tổng hợp và gửi danh sách vi phạm an toàn vào 18:00 mỗi ngày.</div>
          </div>
          <label className={styles.switch}>
            <input 
              type="checkbox" 
              checked={emailNotifications} 
              onChange={(e) => setEmailNotifications(e.target.checked)}
            />
            <span className={styles.slider}></span>
          </label>
        </div>

        <div className={styles.settingRow}>
          <div>
            <div className={styles.settingLabel}>SMS cảnh báo khẩn cấp (Emergency SMS)</div>
            <div className={styles.settingDesc}>Gửi tin nhắn trực tiếp đến giám sát an toàn khi phát hiện lỗi mức độ Danger.</div>
          </div>
          <label className={styles.switch}>
            <input 
              type="checkbox" 
              checked={smsAlerts} 
              onChange={(e) => setSmsAlerts(e.target.checked)}
            />
            <span className={styles.slider}></span>
          </label>
        </div>

        <div className={styles.settingRow}>
          <div>
            <div className={styles.settingLabel}>Tự động ghi hình sự cố (Auto Record)</div>
            <div className={styles.settingDesc}>Tự động ghi lại luồng camera 10 giây trước và sau khi xảy ra vi phạm.</div>
          </div>
          <label className={styles.switch}>
            <input 
              type="checkbox" 
              checked={autoRecord} 
              onChange={(e) => setAutoRecord(e.target.checked)}
            />
            <span className={styles.slider}></span>
          </label>
        </div>
      </div>

      {/* Database General Config */}
      <div className={`${styles.card} glass-panel`}>
        <div className={styles.title}>
          <span className="material-symbols-outlined text-primary">settings_system_daydream</span>
          Lưu trữ dữ liệu & Camera
        </div>
        <form onSubmit={handleSaveGeneral}>
          <div className="input-group" style={{ marginBottom: '20px' }}>
            <label className="input-label" htmlFor="retention">Thời gian lưu trữ Snapshot vi phạm (Ngày)</label>
            <input 
              type="number" 
              id="retention" 
              className="input-field" 
              value={retentionDays} 
              onChange={(e) => setRetentionDays(parseInt(e.target.value))}
              style={{ paddingLeft: '12px', maxWidth: '240px' }}
              min="7"
              max="365"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Lưu thiết lập lưu trữ
          </button>
        </form>
      </div>

    </div>
  );
}
