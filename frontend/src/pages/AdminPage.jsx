import { useEffect, useMemo, useState } from 'react';
import api, { downloadExcel } from '../services/api';

const initialFilter = {
  school: '',
  student_name: '',
  phone: '',
  profile_status: '',
  tier_level: '',
  is_contacted: '',
  is_visited: '',
  owner_name: '',
  intent_level: '',
  max_grade_rank: '',
  max_class_rank: '',
  min_total_score: '',
  max_total_score: '',
};

const statusOptions = ['', '待完善', '已提交', '老师已联系'];
const tierOptions = ['', '特优生', '一批预录', '二等预录', '待观察', '放弃', '无效'];
const intentOptions = ['', '强', '中', '弱', '未沟通'];

const filterLabels = {
  school: '学校', student_name: '学生姓名', phone: '手机号', profile_status: '当前状态', tier_level: '分层等级',
  is_contacted: '是否已联系', is_visited: '是否已来校', owner_name: '负责人', intent_level: '意向强度',
  max_grade_rank: '年级排名上限', max_class_rank: '班级排名上限', min_total_score: '最低总分', max_total_score: '最高总分',
};

function StatCard({ title, value }) {
  return <div className="stat-card"><span>{title}</span><b>{value}</b></div>;
}

export default function AdminPage({ logout, adminName }) {
  const [filters, setFilters] = useState(initialFilter);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({});
  const [active, setActive] = useState(null);
  const [followNote, setFollowNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async (query = filters) => {
    setLoading(true);
    setNotice('');
    try {
      const { data } = await api.get('/admin/students', { params: query });
      setStudents(data.students || []);
      setStats(data.stats || {});
      if (active?.student?.id) {
        const detail = await api.get(`/admin/students/${active.student.id}`);
        setActive(detail.data);
      }
    } catch {
      setNotice('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = async (id) => {
    const { data } = await api.get(`/admin/students/${id}`);
    setActive(data);
  };

  const resetFilters = () => {
    setFilters(initialFilter);
    load(initialFilter);
  };

  const saveAdminFields = async () => {
    await api.put(`/admin/students/${active.student.id}`, active.student);
    await openDetail(active.student.id);
    await load();
    setNotice('操作成功');
  };

  const addFollow = async () => {
    if (!followNote.trim()) return;
    await api.post(`/admin/students/${active.student.id}/followups`, { note: followNote });
    setFollowNote('');
    await openDetail(active.student.id);
  };

  const statItems = useMemo(() => ([
    ['学生总数', stats.total || 0],
    ['已提交', stats.submitted || 0],
    ['待完善', stats.pending || 0],
    ['老师已联系', stats.contactedStatus || 0],
    ['特优生', stats.elite || 0],
    ['一批预录', stats.firstBatch || 0],
    ['二等预录', stats.secondBatch || 0],
    ['待观察', stats.watch || 0],
    ['已联系', stats.contacted || 0],
    ['未联系', stats.notContacted || 0],
  ]), [stats]);

  return (
    <div className="page-stack">
      <div className="card wide">
        <div className="toolbar">
          <div>
            <h2>优秀生信息管理后台</h2>
            <p className="muted">当前管理员：{adminName}</p>
          </div>
          <div className="toolbar">
            <button className="btn" onClick={() => load()}>刷新数据</button>
            <button className="btn" onClick={() => downloadExcel(filters)}>导出 Excel</button>
            <button className="btn" onClick={() => window.confirm('确认退出登录吗？') && logout()}>退出登录</button>
          </div>
        </div>

        <div className="stats-grid">
          {statItems.map(([title, value]) => <StatCard key={title} title={title} value={value} />)}
        </div>

        <section className="section-card">
          <h3>筛选条件</h3>
          <div className="form-grid four">
            {Object.keys(filters).map((k) => {
              if (k === 'profile_status') {
                return (
                  <label className="field" key={k}><span>{filterLabels[k]}</span>
                    <select value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}>
                      {statusOptions.map((opt) => <option key={opt} value={opt}>{opt || '全部'}</option>)}
                    </select>
                  </label>
                );
              }
              if (k === 'tier_level') {
                return (
                  <label className="field" key={k}><span>{filterLabels[k]}</span>
                    <select value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}>
                      {tierOptions.map((opt) => <option key={opt} value={opt}>{opt || '全部'}</option>)}
                    </select>
                  </label>
                );
              }
              if (k === 'intent_level') {
                return (
                  <label className="field" key={k}><span>{filterLabels[k]}</span>
                    <select value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}>
                      {intentOptions.map((opt) => <option key={opt} value={opt}>{opt || '全部'}</option>)}
                    </select>
                  </label>
                );
              }
              if (k === 'is_contacted' || k === 'is_visited') {
                return (
                  <label className="field" key={k}><span>{filterLabels[k]}</span>
                    <select value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}>
                      <option value="">全部</option>
                      <option value="1">是</option>
                      <option value="0">否</option>
                    </select>
                  </label>
                );
              }
              return (
                <label className="field" key={k}>
                  <span>{filterLabels[k]}</span>
                  <input value={filters[k]} placeholder={`请输入${filterLabels[k]}`} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })} />
                </label>
              );
            })}
          </div>
          <div className="toolbar">
            <button className="btn primary" onClick={() => load()}>筛选</button>
            <button className="btn" onClick={resetFilters}>重置筛选</button>
          </div>
        </section>

        {notice && <p className="alert success">{notice}</p>}
        {loading && <p className="muted">正在加载数据...</p>}

        {!loading && students.length === 0 ? (
          <div className="empty">暂无学生信息，请等待家长提交。</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>学生姓名</th><th>手机号</th><th>学校</th><th>班级</th><th>总分</th><th>年级排名</th><th>班级排名</th>
                  <th>当前状态</th><th>分层等级</th><th>是否联系</th><th>是否来校</th><th>负责人</th><th>提交时间</th><th>更新时间</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td><td>{s.phone || '-'}</td><td>{s.current_school || '-'}</td><td>{s.class_name || '-'}</td><td>{s.total_score ?? '-'}</td>
                    <td>{s.grade_rank ?? '-'}</td><td>{s.class_rank ?? '-'}</td><td>{s.profile_status || '-'}</td><td>{s.tier_level || '-'}</td>
                    <td>{Number(s.is_contacted) === 1 ? '是' : '否'}</td><td>{Number(s.is_visited) === 1 ? '是' : '否'}</td><td>{s.owner_name || '-'}</td>
                    <td>{s.submitted_at || '-'}</td><td>{s.updated_at || '-'}</td><td><button className="btn" onClick={() => openDetail(s.id)}>查看详情</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && (
        <div className="card wide">
          <div className="toolbar">
            <h3>学生详情</h3>
            <button className="btn" onClick={() => setActive(null)}>返回列表</button>
          </div>
          <p className="muted">{active.student.name} ｜ {active.student.current_school || '-'} ｜ {active.student.class_name || '-'} ｜ 当前状态：{active.student.profile_status || '-'}</p>

          <section className="section-card"><h4>学生基础信息</h4><p>性别：{active.student.gender || '-'}；出生年月：{active.student.birth_month || '-'}；户籍地址：{active.student.hukou_address || '-'}</p></section>
          <section className="section-card"><h4>家长联系方式</h4><p>父亲：{active.student.father_name || '-'} {active.student.father_phone || '-'}；母亲：{active.student.mother_name || '-'} {active.student.mother_phone || '-'}</p></section>
          <section className="section-card"><h4>近期考试成绩</h4><p>考试：{active.student.latest_exam_name || '-'}；总分：{active.student.total_score ?? '-'}；年级排名：{active.student.grade_rank ?? '-'}；班级排名：{active.student.class_rank ?? '-'}</p></section>
          <section className="section-card"><h4>学科成绩</h4><p>语文 {active.student.chinese_score ?? '-'}，数学 {active.student.math_score ?? '-'}，英语 {active.student.english_score ?? '-'}</p></section>
          <section className="section-card"><h4>荣誉特长</h4><p>{active.student.competitions || '暂无'}</p><p>{active.student.honors || ''}</p></section>
          <section className="section-card"><h4>推荐同学</h4><p>{(active.student.recommended_students || []).map((x) => x.name).join('、') || '暂无'}</p></section>

          <section className="section-card">
            <h4>后台管理信息</h4>
            <div className="form-grid four">
              <label className="field"><span>当前状态</span><select value={active.student.profile_status || ''} onChange={(e) => setActive({ ...active, student: { ...active.student, profile_status: e.target.value } })}>{statusOptions.slice(1).map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
              <label className="field"><span>分层等级</span><select value={active.student.tier_level || ''} onChange={(e) => setActive({ ...active, student: { ...active.student, tier_level: e.target.value } })}>{tierOptions.slice(1).map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
              <label className="field"><span>意向强度</span><select value={active.student.intent_level || ''} onChange={(e) => setActive({ ...active, student: { ...active.student, intent_level: e.target.value } })}>{intentOptions.slice(1).map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
              <label className="field"><span>家长态度</span><select value={active.student.parent_attitude || '未沟通'} onChange={(e) => setActive({ ...active, student: { ...active.student, parent_attitude: e.target.value } })}>{['积极', '犹豫', '不积极', '未沟通'].map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
              <label className="field"><span>是否联系</span><select value={String(active.student.is_contacted ?? 0)} onChange={(e) => setActive({ ...active, student: { ...active.student, is_contacted: Number(e.target.value) } })}><option value="1">是</option><option value="0">否</option></select></label>
              <label className="field"><span>是否来校</span><select value={String(active.student.is_visited ?? 0)} onChange={(e) => setActive({ ...active, student: { ...active.student, is_visited: Number(e.target.value) } })}><option value="1">是</option><option value="0">否</option></select></label>
              <label className="field"><span>来校时间</span><input value={active.student.visit_time || ''} onChange={(e) => setActive({ ...active, student: { ...active.student, visit_time: e.target.value } })} /></label>
              <label className="field"><span>负责人</span><input value={active.student.owner_name || ''} onChange={(e) => setActive({ ...active, student: { ...active.student, owner_name: e.target.value } })} /></label>
              <label className="field"><span>下次跟进时间</span><input value={active.student.next_follow_up_time || ''} onChange={(e) => setActive({ ...active, student: { ...active.student, next_follow_up_time: e.target.value } })} /></label>
              <label className="field"><span>关键备注</span><input value={active.student.key_notes || ''} onChange={(e) => setActive({ ...active, student: { ...active.student, key_notes: e.target.value } })} /></label>
              <label className="field"><span>风险点</span><input value={active.student.risk_points || ''} onChange={(e) => setActive({ ...active, student: { ...active.student, risk_points: e.target.value } })} /></label>
              <label className="field"><span>推荐价值</span><input value={active.student.recommendation_value || ''} onChange={(e) => setActive({ ...active, student: { ...active.student, recommendation_value: e.target.value } })} /></label>
            </div>
            <button className="btn primary" onClick={saveAdminFields}>保存修改</button>
          </section>

          <section className="section-card">
            <h4>跟进记录</h4>
            <ul>
              {active.followUps.map((f) => <li key={f.id}>{f.created_at} - {f.created_by}：{f.note}</li>)}
            </ul>
            <textarea rows="2" placeholder="请输入跟进内容" value={followNote} onChange={(e) => setFollowNote(e.target.value)} />
            <button className="btn" onClick={addFollow}>新增跟进记录</button>
          </section>
        </div>
      )}
    </div>
  );
}
