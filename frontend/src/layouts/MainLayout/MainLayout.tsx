import { NavLink, Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import useTheme from '@/hooks/useTheme';
import styles from './MainLayout.module.css';
import { mapViolationType } from '@/utils/translation';

interface NotificationItem {
  id: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [emergencyAlertActive, setEmergencyAlertActive] = useState(false);
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  const notificationsRef = useRef<HTMLDivElement>(null);

  // Custom event listener for safety violations
  useEffect(() => {
    const handleViolation = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      
      // 1. Add to header notifications
      setNotifications(prev => [
        {
          id: detail.id || String(Date.now()),
          type: 'danger',
          title: '🚨 Phát hiện Vi phạm!',
          message: `${detail.camera_id}: phát hiện ${mapViolationType(detail.type)} (${(detail.confidence * 100).toFixed(0)}%)`,
          time: detail.timestamp,
          read: false
        },
        ...prev
      ]);
      
      // 2. Add to active toasts
      const newToast = {
        id: detail.id || String(Date.now()),
        camera_id: detail.camera_id,
        type: detail.type,
        confidence: detail.confidence,
        timestamp: detail.timestamp
      };
      
      setToasts(prev => [...prev, newToast]);
      
      // Auto-dismiss toast after 5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 5000);
    };
    
    window.addEventListener('violation-detected', handleViolation);
    return () => window.removeEventListener('violation-detected', handleViolation);
  }, []);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);



  // Determine current page title
  const getPageTitle = (path: string) => {
    switch (path) {
      case '/':
        return 'Tổng quan giám sát';
      case '/cameras':
        return 'Quản lý Camera giám sát';
      case '/violations':
        return 'Nhật ký vi phạm an toàn';
      case '/reports':
        return 'Báo cáo & Thống kê tuân thủ';
      case '/settings':
        return 'Cấu hình hệ thống';
      case '/help':
        return 'Trợ giúp & Tài liệu';
      default:
        return 'VisionGuard AI';
    }
  };

  const handleEmergencyAlert = () => {
    setEmergencyAlertActive(true);
    alert('🔴 EMERGENCY SYSTEM ALERT ACTIVATED! Broadcast sent to safety officers.');
    setTimeout(() => setEmergencyAlertActive(false), 5000);
  };

  return (
    <div className={styles.container}>
      {/* Top Header Navbar */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.breadcrumbs}>
            <span className={styles.breadcrumbParent}>Console</span>
            <span className={styles.breadcrumbSeparator}>/</span>
            <h2 className={styles.headerTitle}>{getPageTitle(location.pathname)}</h2>
          </div>
        </div>
        
        <div className={styles.headerRight}>

          {/* Theme Toggle */}
          <button 
            className={styles.iconBtn} 
            onClick={toggleTheme} 
            title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
            aria-label="Toggle Theme"
          >
            <span className="material-symbols-outlined">
              {theme === 'light' ? 'dark_mode' : 'light_mode'}
            </span>
          </button>
          
          {/* Notifications */}
          <div className={styles.notificationsWrapper} ref={notificationsRef}>
            <button 
              className={`${styles.iconBtn} ${notificationsOpen ? styles.iconBtnActive : ''}`} 
              aria-label="Notifications"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <span className="material-symbols-outlined">notifications</span>
              {notifications.some(n => !n.read) && (
                <span className={styles.notificationDot}></span>
              )}
            </button>
            
            {notificationsOpen && (
              <div className={styles.notificationDropdown}>
                <div className={styles.dropdownHeader}>
                  <h3>Thông báo quan trọng</h3>
                  {notifications.some(n => !n.read) && (
                    <button 
                      className={styles.markReadBtn}
                      onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))}
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
                <div className={styles.dropdownList}>
                  {notifications.length === 0 ? (
                    <div className={styles.emptyState}>Không có thông báo nào</div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`${styles.notificationItem} ${n.read ? styles.notificationItemRead : ''}`}
                        onClick={() => {
                          setNotifications(notifications.map(item => item.id === n.id ? { ...item, read: true } : item));
                        }}
                      >
                        <div className={`${styles.statusIndicator} ${styles[n.type]}`}></div>
                        <div className={styles.itemContent}>
                          <div className={styles.itemTitleRow}>
                            <span className={styles.itemTitle}>{n.title}</span>
                            <span className={styles.itemTime}>{n.time}</span>
                          </div>
                          <p className={styles.itemMessage}>{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Profile */}
          <button className={styles.profileBtn} aria-label="Profile" onClick={() => navigate('/settings')}>
            <div className={styles.avatar}>
              <span>AD</span>
            </div>
          </button>
        </div>
      </header>

      {/* Side Navigation Bar */}
      <nav className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <h1 className={styles.logoText}>VisionGuard AI</h1>
          </Link>
          <p className={styles.logoSubText}>🔴 Đang giám sát an toàn</p>
        </div>

        <ul className={styles.navLinksList}>
          <li>
            <NavLink 
              to="/" 
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className="material-symbols-outlined">dashboard</span>
              <span>Tổng quan</span>
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/cameras" 
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className="material-symbols-outlined">videocam</span>
              <span>Camera giám sát</span>
            </NavLink>
          </li>

          <li>
            <NavLink 
              to="/violations" 
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className="material-symbols-outlined">warning</span>
              <span>Nhật ký vi phạm</span>
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/reports" 
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className="material-symbols-outlined">assessment</span>
              <span>Báo cáo thống kê</span>
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/settings" 
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className="material-symbols-outlined">settings</span>
              <span>Cấu hình hệ thống</span>
            </NavLink>
          </li>
        </ul>

        {/* Emergency Alert Action */}
        <button 
          className={styles.alertBtn} 
          onClick={handleEmergencyAlert}
          style={{ opacity: emergencyAlertActive ? 0.7 : 1 }}
        >
          <span className="material-symbols-outlined">emergency</span>
          <span>Cảnh báo khẩn cấp</span>
        </button>

        {/* Sidebar Footer Link list */}
        <div className={styles.sidebarFooter}>
          <NavLink to="/help" className={styles.sidebarFooterItem}>
            <span className="material-symbols-outlined">help</span>
            <span>Trợ giúp</span>
          </NavLink>
          <Link to="/login" className={styles.sidebarFooterItem}>
            <span className="material-symbols-outlined">logout</span>
            <span>Đăng xuất</span>
          </Link>
        </div>
      </nav>

      {/* Main Content Pane */}
      <main className={styles.main}>
        <div className={styles.contentWrapper}>
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className={styles.mobileNav}>
        <NavLink to="/" className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`}>
          <span className="material-symbols-outlined">dashboard</span>
          <span>Tổng quan</span>
        </NavLink>
        <NavLink to="/cameras" className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`}>
          <span className="material-symbols-outlined">videocam</span>
          <span>Camera</span>
        </NavLink>
        <NavLink to="/violations" className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`}>
          <span className="material-symbols-outlined">warning</span>
          <span>Vi phạm</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`}>
          <span className="material-symbols-outlined">settings</span>
          <span>Cài đặt</span>
        </NavLink>
      </nav>
      {/* Toast notifications container */}
      <div style={{
        position: 'fixed', top: '70px', right: '20px', zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px', width: '100%'
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            background: 'rgba(239, 68, 68, 0.95)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px',
            padding: '16px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: '4px',
            animation: `${styles.slideIn} 0.3s cubic-bezier(0.16, 1, 0.3, 1)`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
                CẢNH BÁO VI PHẠM!
              </strong>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>{toast.timestamp}</span>
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px', lineHeight: '1.4' }}>
              <strong>{toast.camera_id}</strong>: Phát hiện <strong>{mapViolationType(toast.type)}</strong> với độ tin cậy <strong>{(toast.confidence * 100).toFixed(0)}%</strong>.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
