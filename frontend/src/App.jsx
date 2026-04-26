import { useMemo, useState } from 'react';
import ParentPage from './pages/ParentPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';

function getPageMode() {
  return window.location.pathname.startsWith('/admin') ? 'admin' : 'parent';
}

export default function App() {
  const [mode] = useState(getPageMode());
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const displayName = localStorage.getItem('displayName');
    return token && role ? { token, role, displayName } : null;
  });

  const onLogin = (token, role, displayName) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    if (displayName) localStorage.setItem('displayName', displayName);
    setSession({ token, role, displayName });
  };

  const logout = () => {
    localStorage.clear();
    setSession(null);
  };

  const content = useMemo(() => {
    if (!session) return <LoginPage mode={mode} onLogin={onLogin} />;
    if (session.role === 'parent') return <ParentPage logout={logout} />;
    return <AdminPage logout={logout} adminName={session.displayName || '管理员'} />;
  }, [session, mode]);

  return <div className="app-container">{content}</div>;
}
