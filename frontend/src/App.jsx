import { useMemo, useState } from 'react';
import ParentPage from './pages/ParentPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  const [mode, setMode] = useState('parent');
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    return token && role ? { token, role } : null;
  });

  const onLogin = (token, role) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    setSession({ token, role });
  };

  const logout = () => {
    localStorage.clear();
    setSession(null);
  };

  const content = useMemo(() => {
    if (!session) return <LoginPage mode={mode} setMode={setMode} onLogin={onLogin} />;
    if (session.role === 'parent') return <ParentPage logout={logout} />;
    return <AdminPage logout={logout} />;
  }, [session, mode]);

  return <div className="container">{content}</div>;
}
