import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './RegisterPage.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) {
      alert('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!agreeTerms) {
      alert('Bạn phải đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.');
      return;
    }

    console.log('User registered:', { fullName, email });
    alert('Đăng ký tài khoản thành công! Quay lại trang đăng nhập.');
    navigate('/login');
  };

  return (
    <>
      {/* Registration Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>VisionGuard AI</h1>
        <p className={styles.subtitle}>Tạo tài khoản mới</p>
      </div>

      {/* Register Form */}
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Full Name */}
        <div className="input-group">
          <label className="input-label" htmlFor="fullName">Họ và Tên</label>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">person</span>
            <input
              type="text"
              id="fullName"
              className="input-field"
              placeholder="Nhập họ và tên"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        </div>

        {/* Work Email */}
        <div className="input-group">
          <label className="input-label" htmlFor="email">Email Công Việc</label>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">mail</span>
            <input
              type="email"
              id="email"
              className="input-field"
              placeholder="name@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {/* Confirm Password */}
        <div className="input-group">
          <label className="input-label" htmlFor="confirmPassword">Xác nhận Mật khẩu</label>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">lock</span>
            <input
              type="password"
              id="confirmPassword"
              className="input-field"
              placeholder="••••••••"
              required
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
            Tôi đồng ý với{' '}
            <a href="#" className={styles.termsLink} onClick={(e) => { e.preventDefault(); alert('Điều khoản dịch vụ'); }}>
              Điều khoản dịch vụ
            </a>{' '}
            và{' '}
            <a href="#" className={styles.termsLink} onClick={(e) => { e.preventDefault(); alert('Chính sách bảo mật'); }}>
              Chính sách bảo mật
            </a>.
          </label>
        </div>

        {/* Submit Button */}
        <button type="submit" className="btn btn-primary styles.submitBtn" style={{ width: '100%' }}>
          Tạo Tài Khoản
        </button>
      </form>

      {/* Footer Link */}
      <div className={styles.footer}>
        Đã có tài khoản?{' '}
        <Link to="/login" className={styles.loginLink}>
          Đăng nhập thay thế
        </Link>
      </div>
    </>
  );
}
