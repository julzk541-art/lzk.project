import { useState } from 'react';
import api from '../services/api';

export default function LoginPage({ mode, onLogin }) {
  const [parentForm, setParentForm] = useState({ phone: '', studentName: '' });
  const [adminForm, setAdminForm] = useState({ phone: '19831906998', name: '李兆康', password: 'lizhaokang666666' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submitParent = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^1\d{10}$/.test(parentForm.phone)) {
      setError('请输入正确的手机号');
      return;
    }
    if (!parentForm.studentName.trim()) {
      setError('请填写学生姓名');
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.post('/parent/login', parentForm);
      onLogin(data.token, 'parent');
    } catch (err) {
      setError(err.response?.data?.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const submitAdmin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const { data } = await api.post('/admin/login', adminForm);
      onLogin(data.token, 'admin', data.displayName);
    } catch (err) {
      setError(err.response?.data?.message || '手机号、姓名或密码错误');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'admin') {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>优秀生信息管理后台</h1>
          <p className="muted">仅限授权管理员访问</p>
          {error && <p className="alert error">{error}</p>}
          <form onSubmit={submitAdmin} className="form-grid">
            <input placeholder="手机号" value={adminForm.phone} onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })} />
            <input placeholder="姓名" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} />
            <input type="password" placeholder="密码" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
            <button type="submit" className="btn primary" disabled={loading}>{loading ? '正在登录...' : '登录后台'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>衡水名校优秀生信息录入</h1>
        <p className="muted">请家长如实填写学生基础信息、成绩信息及综合素质信息，提交后可继续登录修改完善。</p>
        {error && <p className="alert error">{error}</p>}
        <form onSubmit={submitParent} className="form-grid">
          <input placeholder="手机号" value={parentForm.phone} onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })} />
          <input placeholder="学生姓名" value={parentForm.studentName} onChange={(e) => setParentForm({ ...parentForm, studentName: e.target.value })} />
          <button type="submit" className="btn primary" disabled={loading}>{loading ? '正在登录...' : '进入信息填报'}</button>
        </form>
        <div className="toolbar" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
          <a className="text-link" href="/admin/login">后台管理员登录</a>
        </div>
      </div>
    </div>
  );
}
