import { Outlet } from 'react-router-dom';
import styles from './AuthLayout.module.css';

export default function AuthLayout() {
  return (
    <div className={styles.container}>
      <div className={`${styles.card} glass-panel`}>
        <Outlet />
      </div>
    </div>
  );
}
