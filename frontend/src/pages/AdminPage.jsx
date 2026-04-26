import { useEffect, useState } from 'react';
import api from '../services/api';

const initialFilter = {
  school: '', max_grade_rank: '', max_class_rank: '', min_total_score: '', max_total_score: '', tier_level: '', is_contacted: '', is_visited: '', owner_name: '', intent_level: ''
};

export default function AdminPage({ logout }) {
  const [filters, setFilters] = useState(initialFilter);
  const [students, setStudents] = useState([]);
  const [active, setActive] = useState(null);
  const [followNote, setFollowNote] = useState('');

  const load = async () => {
    const { data } = await api.get('/admin/students', { params: filters });
    setStudents(data);
    if (active) {
      const detail = await api.get(`/admin/students/${active.student.id}`);
      setActive(detail.data);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id) => {
    const { data } = await api.get(`/admin/students/${id}`);
    setActive(data);
  };

  const updateBackendField = async (patch) => {
    await api.put(`/admin/students/${active.student.id}`, patch);
    await openDetail(active.student.id);
    await load();
  };

  const addFollow = async () => {
    if (!followNote) return;
    await api.post(`/admin/students/${active.student.id}/follow-ups`, { note: followNote });
    setFollowNote('');
    await openDetail(active.student.id);
  };

  return (
    <div className="card wide">
      <div className="toolbar"><h2>招生后台</h2><div><button onClick={load}>筛选</button><button onClick={logout}>退出</button><a href="http://localhost:4000/api/admin/export" target="_blank">导出Excel</a></div></div>
      <div className="form-grid two">
        {Object.keys(filters).map((k) => <input key={k} placeholder={k} value={filters[k]} onChange={(e)=>setFilters({...filters,[k]:e.target.value})} />)}
      </div>
      <table>
        <thead><tr><th>姓名</th><th>学校</th><th>总分</th><th>年排</th><th>等级</th><th>联系</th></tr></thead>
        <tbody>
          {students.map((s)=><tr key={s.id} onClick={()=>openDetail(s.id)}><td>{s.name}</td><td>{s.current_school}</td><td>{s.total_score}</td><td>{s.grade_rank}</td><td>{s.tier_level}</td><td>{s.is_contacted ? '是':'否'}</td></tr>)}
        </tbody>
      </table>

      {active && (
        <div className="detail">
          <h3>学生详情：{active.student.name}</h3>
          <p>{active.student.current_school} / {active.student.class_name} / 总分 {active.student.total_score}</p>
          <div className="form-grid two">
            {['tier_level','intent_level','parent_attitude','owner_name','next_follow_up_time','key_notes','risk_points','recommendation_value','contact_status'].map((f)=><input key={f} placeholder={f} value={active.student[f] || ''} onChange={(e)=>setActive({...active,student:{...active.student,[f]:e.target.value}})} />)}
          </div>
          <div className="toolbar">
            <label><input type="checkbox" checked={!!active.student.is_contacted} onChange={(e)=>setActive({...active,student:{...active.student,is_contacted:e.target.checked ? 1 : 0}})} /> 是否联系</label>
            <label><input type="checkbox" checked={!!active.student.is_visited} onChange={(e)=>setActive({...active,student:{...active.student,is_visited:e.target.checked ? 1 : 0}})} /> 是否来校</label>
            <button onClick={()=>updateBackendField(active.student)}>保存后台字段</button>
          </div>

          <h4>跟进记录</h4>
          <ul>{active.followUps.map((f)=><li key={f.id}>{f.created_at} - {f.created_by}: {f.note}</li>)}</ul>
          <textarea rows="3" value={followNote} onChange={(e)=>setFollowNote(e.target.value)} placeholder="新增跟进记录" />
          <button onClick={addFollow}>新增跟进</button>
        </div>
      )}
    </div>
  );
}
