import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err: unknown) {
      console.error('Đăng nhập thất bại:', err);
      setError(err instanceof Error ? err.message : 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Brand Logo Header */}
      <div className={styles.header}>
        <span className={`material-symbols-outlined ${styles.logoIcon} icon-filled`}>
          security
        </span>
        <h1 className={styles.title}>VisionGuard AI</h1>
        <p className={styles.subtitle}>Trung Tâm Quản Trị An Toàn Công Trường</p>
      </div>

      {error && (
        <div
          className="alert alert-danger"
          style={{
            padding: '10px 14px',
            marginBottom: '16px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            border: '1px solid var(--color-danger)',
          }}
        >
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Username Field */}
        <div className="input-group">
          <label className="input-label" htmlFor="username">Tên đăng nhập</label>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">person</span>
            <input
              type="text"
              id="username"
              className="input-field"
              placeholder="Nhập tên đăng nhập"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="input-group">
          <div className={styles.labelWrapper}>
            <label className="input-label" htmlFor="password">Mật khẩu</label>
          </div>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">lock</span>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              className="input-field"
              placeholder="Nhập mật khẩu"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <span className="material-symbols-outlined text-lg">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary styles.submitBtn"
          style={{ width: '100%', marginTop: '8px' }}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-sm animate-spin">sync</span>
              Đang xác thực...
            </>
          ) : (
            <>
              Đăng nhập
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </>
          )}
        </button>
      </form>

      {/* Register Link */}
      <div className={styles.footer}>
        Chưa có tài khoản?{' '}
        <Link to="/register" className={styles.signupLink}>
          Tạo tài khoản mới
        </Link>
      </div>
    </>
  );
}
