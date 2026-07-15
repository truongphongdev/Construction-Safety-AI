import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      // Mock login success and redirect to dashboard
      console.log('Logged in successfully:', email);
      navigate('/');
    } else {
      alert('Vui lòng điền đầy đủ email và mật khẩu.');
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
        <p className={styles.subtitle}>Safety Command Center</p>
      </div>

      {/* Login Form */}
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Email Field */}
        <div className="input-group">
          <label className="input-label" htmlFor="email">Email</label>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">mail</span>
            <input
              type="email"
              id="email"
              className="input-field"
              placeholder="Nhập địa chỉ email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="input-group">
          <div className={styles.labelWrapper}>
            <label className="input-label" htmlFor="password">Mật khẩu</label>
            <a href="#" className={styles.forgotLink} onClick={(e) => { e.preventDefault(); alert('Chức năng khôi phục mật khẩu đang phát triển.'); }}>
              Quên mật khẩu?
            </a>
          </div>
          <div className="input-wrapper">
            <span className="material-symbols-outlined input-icon">lock</span>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              className="input-field"
              placeholder="Nhập mật khẩu"
              required
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
        <button type="submit" className="btn btn-primary styles.submitBtn" style={{ width: '100%' }}>
          Đăng nhập
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </form>

      {/* Register Link */}
      <div className={styles.footer}>
        Chưa có tài khoản? 
        <Link to="/register" className={styles.signupLink}>
          Tạo tài khoản
        </Link>
      </div>
    </>
  );
}
