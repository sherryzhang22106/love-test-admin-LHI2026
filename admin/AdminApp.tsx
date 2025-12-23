import React, { useState, useEffect } from 'react';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import { adminApi } from './services/adminApi';

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  admin: { id: string; email: string; name: string } | null;
}

const AdminApp: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    admin: null,
  });

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const adminData = localStorage.getItem('admin_data');

    if (token && adminData) {
      try {
        const admin = JSON.parse(adminData);
        setAuthState({ isAuthenticated: true, token, admin });
        adminApi.setToken(token);
      } catch (e) {
        console.error('Failed to parse admin data:', e);
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_data');
      }
    }
  }, []);

  const handleLogin = (token: string, user: any) => {
    const admin = user || { id: '', email: '', name: 'Admin' };
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_data', JSON.stringify(admin));
    setAuthState({ isAuthenticated: true, token, admin });
    adminApi.setToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_data');
    setAuthState({ isAuthenticated: false, token: null, admin: null });
    adminApi.setToken(null);
  };

  if (!authState.isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <Dashboard admin={authState.admin!} onLogout={handleLogout} />;
};

export default AdminApp;
