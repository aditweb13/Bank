import React, { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import LoginPage from './pages/LoginPage';
import AdminApp from './pages/AdminApp';
import CustomerApp from './pages/CustomerApp';

// Global Error Boundary for catching UI runtime exceptions
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>🏦⚠️</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#94a3b8', maxWidth: '480px', marginBottom: '24px', fontSize: '14px' }}>
            The banking application encountered an unexpected error. Your funds and session security remain protected.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reload AMC Bank
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('amc_token');
  const role = localStorage.getItem('amc_role');
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'ROLE_ADMIN') return <Navigate to="/customer" replace />;
  return children;
}

function CustomerRoute({ children }) {
  const token = localStorage.getItem('amc_token');
  const role = localStorage.getItem('amc_role');
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'ROLE_CUSTOMER') return <Navigate to="/admin" replace />;
  return children;
}

function AppRoutes() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('amc_token');
    localStorage.removeItem('amc_username');
    localStorage.removeItem('amc_role');
    localStorage.removeItem('amc_customer_name');
    localStorage.removeItem('amc_customer_id');
    navigate('/login', { replace: true });
  };

  const token = localStorage.getItem('amc_token');
  const role = localStorage.getItem('amc_role');

  const rootDestination = !token
    ? '/login'
    : role === 'ROLE_ADMIN'
      ? '/admin'
      : '/customer';

  return (
    <Routes>
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to={role === 'ROLE_ADMIN' ? '/admin' : '/customer'} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <AdminApp onLogout={handleLogout} />
          </AdminRoute>
        }
      />
      <Route
        path="/customer/*"
        element={
          <CustomerRoute>
            <CustomerApp onLogout={handleLogout} />
          </CustomerRoute>
        }
      />
      <Route path="/" element={<Navigate to={rootDestination} replace />} />
      <Route path="*" element={<Navigate to={rootDestination} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
