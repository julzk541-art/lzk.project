import { useState } from 'react';
import api from '../services/api';

export default function LoginPage({ mode, setMode, onLogin }) {
  const [parentForm, setParentForm] = useState({ phone: '', studentName: '' });
  const [adminForm, setAdminForm] = useState({ username: 'admin', password: '123456' });
  const [error, setError] = useState('');

  const submitParent = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/parent-login', parentForm);
      onLogin(data.token, 'parent');
    } catch (err) {
      setError(err.response?.data?.message || '登录失败');
    }
  };

  const submitAdmin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/admin-login', adminForm);
      onLogin(data.token, 'admin');
    } catch (err) {
      setError(err.response?.data?.message || '登录失败');
    }
  };

  return (
    <div className="card">
      <h1>招生学生信息采集系统</h1>
      <div className="tabs">
        <button className={mode === 'parent' ? 'active' : ''} onClick={() => setMode('parent')}>家长端</button>
        <button className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>后台端</button>
      </div>
      {error && <p className="error">{error}</p>}
      {mode === 'parent' ? (
        <form onSubmit={submitParent} className="form-grid">
          <input placeholder="手机号" value={parentForm.phone} onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })} />
          <input placeholder="学生姓名" value={parentForm.studentName} onChange={(e) => setParentForm({ ...parentForm, studentName: e.target.value })} />
          <button type="submit">家长登录</button>
        </form>
      ) : (
        <form onSubmit={submitAdmin} className="form-grid">
          <input placeholder="管理员账号" value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} />
          <input type="password" placeholder="密码" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
          <button type="submit">后台登录</button>
        </form>
      )}
    </div>
  );
}
