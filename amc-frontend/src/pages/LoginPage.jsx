import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(username, password);
      localStorage.setItem('amc_token', data.token);
      localStorage.setItem('amc_username', data.username);
      localStorage.setItem('amc_role', data.role);
      localStorage.setItem('amc_customer_name', data.customerName || '');
      localStorage.setItem('amc_customer_id', data.customerId || '');

      toast.success('Welcome back!', `Signed in as ${data.username}`);

      if (data.role === 'ROLE_ADMIN') navigate('/admin');
      else navigate('/customer');
    } catch (err) {
      toast.error('Login Failed', err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-branding">
        <div className="login-brand-icon">A</div>
        <div className="login-brand-name">AMC Bank</div>
        <div className="login-brand-sub">
          Next-generation digital banking platform — secure, fast, and built for the modern era.
        </div>
        <div className="login-features">
          {[
            'JWT-secured authentication with role-based access',
            'Real-time fund transfers & transaction history',
            'Loan lifecycle management with EMI schedules',
            'Fixed deposits, beneficiary management & more',
          ].map(f => (
            <div key={f} className="login-feature">
              <div className="login-feature-dot" />
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="login-panel">
        <div style={{ marginBottom: 32 }}>
          <div className="login-panel-title">Sign In</div>
          <div className="login-panel-sub">Enter your credentials to access your account</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username / Customer Email</label>
            <input
              className="form-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin or customer@email.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
            {loading ? '⏳ Signing In...' : '🔒 Sign In'}
          </button>
        </form>

        <div className="divider" />

        <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '12px 16px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>Demo Credentials</div>
          <div>🔑 <strong>Admin:</strong> admin / admin123</div>
          <div style={{ marginTop: 4 }}>👤 <strong>Customer:</strong> Khushi@example.com / customer123</div>
        </div>
      </div>
    </div>
  );
}
