import { useEffect, useState } from 'react';
import api from '../services/api';

const defaultStudent = {
  name: '', gender: '', birth_month: '', current_school: '', class_name: '', enrollment_school: '', hukou_address: '',
  father_name: '', father_phone: '', father_job: '', mother_name: '', mother_phone: '', mother_job: '',
  latest_exam_name: '', total_score: '', grade_rank: '', class_rank: '',
  chinese_score: '', math_score: '', english_score: '', physics_score: '', chemistry_score: '', politics_score: '', history_score: '', geography_score: '', biology_score: '',
  competitions: '', honors: '', class_roles: '', subject_strengths: '', specialties: '', self_evaluation: '', reading_notes: '',
  profile_status: '待完善', exam_history: [], recommended_students: [],
};

const fieldLabels = {
  name: '学生姓名', gender: '性别', birth_month: '出生年月', current_school: '就读学校', class_name: '班级', enrollment_school: '学籍学校', hukou_address: '户籍地址',
  father_name: '父亲姓名', father_phone: '父亲电话', father_job: '父亲单位及职务', mother_name: '母亲姓名', mother_phone: '母亲电话', mother_job: '母亲单位及职务',
  latest_exam_name: '最近一次考试名称', total_score: '总分', grade_rank: '年级排名', class_rank: '班级排名',
  chinese_score: '语文', math_score: '数学', english_score: '英语', physics_score: '物理', chemistry_score: '化学', politics_score: '政治', history_score: '历史', geography_score: '地理', biology_score: '生物',
};

function Field({ student, setStudent, name, required = false }) {
  return (
    <label className="field">
      <span>{fieldLabels[name]}{required ? <em>*</em> : null}</span>
      <input
        value={student[name] ?? ''}
        onChange={(e) => setStudent({ ...student, [name]: e.target.value })}
        placeholder={`请输入${fieldLabels[name]}`}
      />
    </label>
  );
}

export default function ParentPage({ logout }) {
  const [student, setStudent] = useState(defaultStudent);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitCard, setSubmitCard] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/parent/profile');
      setStudent({ ...defaultStudent, ...data });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const buildPayload = () => ({
    ...student,
    exam_history: Array.isArray(student.exam_history) ? student.exam_history : [],
    recommended_students: Array.isArray(student.recommended_students) ? student.recommended_students : [],
  });

  const saveDraft = async () => {
    setMsg({ type: '', text: '' });
    setSaving(true);
    try {
      const { data } = await api.put('/parent/profile/save-draft', buildPayload());
      setStudent(data.student);
      setSubmitCard(false);
      setMsg({ type: 'success', text: '草稿已保存，下次登录可继续修改。' });
    } catch {
      setMsg({ type: 'error', text: '提交失败，请检查网络或稍后重试。' });
    } finally {
      setSaving(false);
    }
  };

  const submitProfile = async () => {
    setMsg({ type: '', text: '' });
    setSaving(true);
    try {
      const { data } = await api.put('/parent/profile/submit', buildPayload());
      setStudent(data.student);
      setSubmitCard(true);
      setMsg({ type: 'success', text: '资料提交成功，后续可继续登录补充或修改。' });
    } catch {
      setMsg({ type: 'error', text: '提交失败，请检查网络或稍后重试。' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card">正在加载数据...</div>;

  return (
    <div className="page-stack">
      <div className="card">
        <div className="toolbar">
          <div>
            <h2>优秀生信息填报</h2>
            <p className="muted">学生姓名：{student.name || '未填写'} ｜ 当前状态：<b>{student.profile_status || '待完善'}</b></p>
          </div>
          <button className="btn" onClick={() => window.confirm('确认退出登录吗？') && logout()}>退出登录</button>
        </div>

        {msg.text && <p className={`alert ${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</p>}

        <section className="section-card">
          <h3>学生基础信息</h3>
          <div className="form-grid three">
            <Field student={student} setStudent={setStudent} name="name" required />
            <Field student={student} setStudent={setStudent} name="gender" />
            <Field student={student} setStudent={setStudent} name="birth_month" />
            <Field student={student} setStudent={setStudent} name="current_school" required />
            <Field student={student} setStudent={setStudent} name="class_name" />
            <Field student={student} setStudent={setStudent} name="enrollment_school" />
            <Field student={student} setStudent={setStudent} name="hukou_address" />
          </div>
        </section>

        <section className="section-card">
          <h3>家长联系方式</h3>
          <div className="form-grid three">
            <Field student={student} setStudent={setStudent} name="father_name" />
            <Field student={student} setStudent={setStudent} name="father_phone" />
            <Field student={student} setStudent={setStudent} name="father_job" />
            <Field student={student} setStudent={setStudent} name="mother_name" />
            <Field student={student} setStudent={setStudent} name="mother_phone" />
            <Field student={student} setStudent={setStudent} name="mother_job" />
          </div>
        </section>

        <section className="section-card">
          <h3>近期考试成绩</h3>
          <div className="form-grid three">
            <Field student={student} setStudent={setStudent} name="latest_exam_name" />
            <Field student={student} setStudent={setStudent} name="total_score" />
            <Field student={student} setStudent={setStudent} name="grade_rank" />
            <Field student={student} setStudent={setStudent} name="class_rank" />
          </div>
        </section>

        <section className="section-card">
          <h3>学科成绩</h3>
          <div className="form-grid three">
            {['chinese_score', 'math_score', 'english_score', 'physics_score', 'chemistry_score', 'politics_score', 'history_score', 'geography_score', 'biology_score'].map((k) => (
              <Field key={k} student={student} setStudent={setStudent} name={k} />
            ))}
          </div>
        </section>

        <section className="section-card">
          <h3>荣誉特长与综合评价</h3>
          <div className="form-grid">
            <textarea rows="2" placeholder="请输入竞赛经历" value={student.competitions || ''} onChange={(e) => setStudent({ ...student, competitions: e.target.value })} />
            <textarea rows="2" placeholder="请输入荣誉奖励" value={student.honors || ''} onChange={(e) => setStudent({ ...student, honors: e.target.value })} />
            <textarea rows="2" placeholder="请输入班干部经历" value={student.class_roles || ''} onChange={(e) => setStudent({ ...student, class_roles: e.target.value })} />
            <textarea rows="2" placeholder="请输入学科优势" value={student.subject_strengths || ''} onChange={(e) => setStudent({ ...student, subject_strengths: e.target.value })} />
            <textarea rows="2" placeholder="请输入特长" value={student.specialties || ''} onChange={(e) => setStudent({ ...student, specialties: e.target.value })} />
            <textarea rows="2" placeholder="请输入自我评价" value={student.self_evaluation || ''} onChange={(e) => setStudent({ ...student, self_evaluation: e.target.value })} />
            <textarea rows="2" placeholder="请输入阅读情况" value={student.reading_notes || ''} onChange={(e) => setStudent({ ...student, reading_notes: e.target.value })} />
          </div>
        </section>

        <section className="section-card">
          <h3>推荐同学</h3>
          <textarea
            rows="2"
            placeholder="示例：李四（13800001111）；王五（13800002222）"
            value={(student.recommended_students || []).map((x) => `${x.name || ''}${x.phone ? `(${x.phone})` : ''}`).join('；')}
            onChange={(e) => {
              const arr = e.target.value.split('；').filter(Boolean).map((text) => ({ name: text.trim() }));
              setStudent({ ...student, recommended_students: arr });
            }}
          />
        </section>

        <div className="toolbar sticky-actions">
          <button className="btn" disabled={saving} onClick={saveDraft}>{saving ? '正在保存...' : '保存草稿'}</button>
          <button className="btn primary" disabled={saving} onClick={submitProfile}>{saving ? '正在提交...' : '提交资料'}</button>
        </div>
      </div>

      {submitCard && (
        <div className="card success-card">
          <h3>提交成功</h3>
          <p>您的资料已成功提交，后续可继续使用手机号和学生姓名登录修改完善。</p>
          <p>学生姓名：{student.name}</p>
          <p>手机号：{student.phone || '-'}</p>
          <p>当前状态：已提交</p>
          <p>提交时间：{student.submitted_at || '-'}</p>
          <div className="toolbar">
            <button className="btn" onClick={() => setSubmitCard(false)}>继续修改资料</button>
            <button className="btn" onClick={() => window.confirm('确认退出登录吗？') && logout()}>退出登录</button>
          </div>
        </div>
      )}
    </div>
  );
}
