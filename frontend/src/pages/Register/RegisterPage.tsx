import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts';
import styles from './RegisterPage.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim() || !password || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Tên đăng nhập phải có ít nhất 3 ký tự.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    if (!agreeTerms) {
      setError('Bạn phải đồng ý với Quy định bảo mật và an toàn hệ thống.');
      return;
    }

    setLoading(true);
    try {
      await register(username.trim(), password, fullName.trim() || undefined);
      setSuccessMsg('Đăng ký tài khoản thành công! Đang chuyển hướng đến trang đăng nhập...');
      setTimeout(() => {
        navigate('/login');
      }, 1200);
    } catch (err: unknown) {
      console.error('Đăng ký thất bại:', err);
      setError(err instanceof Error ? err.message : 'Không thể đăng ký tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Registration Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>VisionGuard AI</h1>
        <p className={styles.subtitle}>Tạo tài khoản quản trị an toàn</p>
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

      {successMsg && (
        <div
          className="alert alert-success"
          style={{
            padding: '10px 14px',
            marginBottom: '16px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            border: '1px solid var(--color-success)',
          }}
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Register Form */}
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Full Name */}
        <div className="input-group">
          <label className="input-label" htmlFor="fullName">Họ và Tên</label>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">badge</span>
            <input
              type="text"
              id="fullName"
              className="input-field"
              placeholder="VD: Nguyễn Văn An"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        </div>

        {/* Username */}
        <div className="input-group">
          <label className="input-label" htmlFor="username">Tên đăng nhập</label>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">person</span>
            <input
              type="text"
              id="username"
              className="input-field"
              placeholder="VD: nguyenvanan"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>

        {/* Password */}
        <div className="input-group">
          <label className="input-label" htmlFor="password">Mật khẩu</label>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">lock</span>
            <input
              type="password"
              id="password"
              className="input-field"
              placeholder="Tối thiểu 6 ký tự"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {/* Confirm Password */}
        <div className="input-group">
          <label className="input-label" htmlFor="confirmPassword">Xác nhận Mật khẩu</label>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">lock_reset</span>
            <input
              type="password"
              id="confirmPassword"
              className="input-field"
              placeholder="Nhập lại mật khẩu"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        {/* Terms and Conditions Checkbox */}
        <div className={styles.checkboxWrapper}>
          <input
            type="checkbox"
            id="terms"
            className={styles.checkbox}
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
          />
          <label htmlFor="terms" className={styles.checkboxLabel}>
            Tôi cam kết tuân thủ quy chế an toàn lao động và bảo mật thông tin nội bộ.
          </label>
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
              Đang tạo tài khoản...
            </>
          ) : (
            <>
              Tạo Tài Khoản
              <span className="material-symbols-outlined text-sm">how_to_reg</span>
            </>
          )}
        </button>
      </form>

      {/* Footer Link */}
      <div className={styles.footer}>
        Đã có tài khoản?{' '}
        <Link to="/login" className={styles.loginLink}>
          Đăng nhập ngay
        </Link>
      </div>
    </>
  );
}
