import { useEffect, useState } from 'react';
import api from '../services/api';

const defaultStudent = {
  name: '', gender: '', birth_month: '', current_school: '', class_name: '', enrollment_school: '', hukou_address: '',
  father_name: '', father_phone: '', father_job: '', mother_name: '', mother_phone: '', mother_job: '',
  latest_exam_name: '', total_score: '', grade_rank: '', class_rank: '',
  chinese_score: '', math_score: '', english_score: '', physics_score: '', chemistry_score: '', politics_score: '', history_score: '', geography_score: '', biology_score: '',
  exam_history: [], competitions: '', honors: '', class_roles: '', subject_strengths: '', specialties: '', self_evaluation: '', reading_notes: '',
  recommended_students: [], profile_status: '待完善', is_submitted: 0
};

export default function ParentPage({ logout }) {
  const [student, setStudent] = useState(defaultStudent);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/parent/student').then((res) => setStudent({ ...defaultStudent, ...res.data }));
  }, []);

  const save = async (submit = false) => {
    const payload = {
      ...student,
      is_submitted: submit ? 1 : 0,
      profile_status: submit ? '已提交' : '待完善',
      exam_history: typeof student.exam_history === 'string' ? JSON.parse(student.exam_history || '[]') : student.exam_history,
      recommended_students: typeof student.recommended_students === 'string' ? JSON.parse(student.recommended_students || '[]') : student.recommended_students,
    };
    const { data } = await api.put('/parent/student', payload);
    setStudent(data);
    setMsg(submit ? '已提交成功' : '已保存');
  };

  return (
    <div className="card">
      <div className="toolbar"><h2>家长端信息填报</h2><button onClick={logout}>退出</button></div>
      <p>当前状态：<b>{student.contact_status === '已联系' ? '老师已联系' : student.profile_status}</b></p>
      <div className="form-grid two">
        {['name','gender','birth_month','current_school','class_name','enrollment_school','hukou_address','father_name','father_phone','father_job','mother_name','mother_phone','mother_job','latest_exam_name','total_score','grade_rank','class_rank'].map((key)=>(
          <input key={key} placeholder={key} value={student[key] ?? ''} onChange={(e)=>setStudent({...student,[key]:e.target.value})} />
        ))}
      </div>
      <h3>学科成绩</h3>
      <div className="form-grid two">
        {['chinese_score','math_score','english_score','physics_score','chemistry_score','politics_score','history_score','geography_score','biology_score'].map((k)=><input key={k} placeholder={k} value={student[k] ?? ''} onChange={(e)=>setStudent({...student,[k]:e.target.value})} />)}
      </div>
      <h3>补充信息（JSON数组字段）</h3>
      <textarea rows="4" value={typeof student.exam_history === 'string' ? student.exam_history : JSON.stringify(student.exam_history)} onChange={(e)=>setStudent({...student,exam_history:e.target.value})} placeholder='历次成绩 JSON，如 [{"exam":"一模","score":560}]' />
      <textarea rows="3" value={student.competitions || ''} onChange={(e)=>setStudent({...student,competitions:e.target.value})} placeholder="竞赛经历" />
      <textarea rows="3" value={student.honors || ''} onChange={(e)=>setStudent({...student,honors:e.target.value})} placeholder="荣誉奖励" />
      <textarea rows="3" value={student.class_roles || ''} onChange={(e)=>setStudent({...student,class_roles:e.target.value})} placeholder="班干部经历" />
      <textarea rows="3" value={student.subject_strengths || ''} onChange={(e)=>setStudent({...student,subject_strengths:e.target.value})} placeholder="学科优势" />
      <textarea rows="3" value={student.specialties || ''} onChange={(e)=>setStudent({...student,specialties:e.target.value})} placeholder="特长" />
      <textarea rows="3" value={student.self_evaluation || ''} onChange={(e)=>setStudent({...student,self_evaluation:e.target.value})} placeholder="自我评价" />
      <textarea rows="3" value={student.reading_notes || ''} onChange={(e)=>setStudent({...student,reading_notes:e.target.value})} placeholder="阅读情况" />
      <textarea rows="4" value={typeof student.recommended_students === 'string' ? student.recommended_students : JSON.stringify(student.recommended_students)} onChange={(e)=>setStudent({...student,recommended_students:e.target.value})} placeholder='推荐同学 JSON，如 [{"name":"张三","phone":"138..."}]' />
      <div className="toolbar">
        <button onClick={() => save(false)}>保存草稿</button>
        <button onClick={() => save(true)}>提交资料</button>
      </div>
      {msg && <p className="success">{msg}</p>}
    </div>
  );
}
