import express from 'express';
import cors from 'cors';
import ExcelJS from 'exceljs';
import { getDb } from './db.js';
import { signToken, verifyToken, requireRole } from './auth.js';
import { calcAutoTier } from './tier.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function parseJsonField(v, fallback = []) {
  try {
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeStudent(row) {
  if (!row) return null;
  return {
    ...row,
    exam_history: parseJsonField(row.exam_history_json),
    recommended_students: parseJsonField(row.recommended_students_json),
  };
}

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/auth/parent-login', async (req, res) => {
  const { phone, studentName } = req.body;
  if (!phone || !studentName) return res.status(400).json({ message: '请输入手机号和学生姓名' });

  const db = await getDb();
  await db.run(
    'INSERT OR IGNORE INTO parent_users (phone, student_name) VALUES (?, ?)',
    [phone, studentName]
  );
  const parent = await db.get('SELECT * FROM parent_users WHERE phone = ? AND student_name = ?', [phone, studentName]);

  let student = await db.get('SELECT * FROM students WHERE parent_user_id = ?', [parent.id]);
  if (!student) {
    await db.run('INSERT INTO students (parent_user_id, name) VALUES (?, ?)', [parent.id, studentName]);
    student = await db.get('SELECT * FROM students WHERE parent_user_id = ?', [parent.id]);
  }

  const token = signToken({ role: 'parent', parentId: parent.id, studentId: student.id, name: parent.student_name });
  res.json({ token, student: normalizeStudent(student) });
});

app.post('/api/auth/admin-login', async (req, res) => {
  const { username, password } = req.body;
  const db = await getDb();
  const admin = await db.get('SELECT * FROM admin_users WHERE username = ? AND password = ?', [username, password]);
  if (!admin) return res.status(401).json({ message: '账号或密码错误' });

  const token = signToken({ role: 'admin', adminId: admin.id, displayName: admin.display_name });
  res.json({ token, displayName: admin.display_name });
});

app.get('/api/parent/student', verifyToken, requireRole('parent'), async (req, res) => {
  const db = await getDb();
  const student = await db.get('SELECT * FROM students WHERE id = ? AND parent_user_id = ?', [req.user.studentId, req.user.parentId]);
  res.json(normalizeStudent(student));
});

app.put('/api/parent/student', verifyToken, requireRole('parent'), async (req, res) => {
  const db = await getDb();
  const payload = req.body;

  const autoTier = calcAutoTier(payload);
  const current = await db.get('SELECT tier_level FROM students WHERE id = ?', [req.user.studentId]);

  await db.run(
    `UPDATE students SET
      name=?, gender=?, birth_month=?, current_school=?, class_name=?, enrollment_school=?, hukou_address=?,
      father_name=?, father_phone=?, father_job=?, mother_name=?, mother_phone=?, mother_job=?,
      latest_exam_name=?, total_score=?, grade_rank=?, class_rank=?,
      chinese_score=?, math_score=?, english_score=?, physics_score=?, chemistry_score=?, politics_score=?,
      history_score=?, geography_score=?, biology_score=?,
      exam_history_json=?, competitions=?, honors=?, class_roles=?, subject_strengths=?, specialties=?,
      self_evaluation=?, reading_notes=?, recommended_students_json=?, profile_status=?, is_submitted=?, contact_status=?,
      tier_level=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND parent_user_id=?`,
    [
      payload.name, payload.gender, payload.birth_month, payload.current_school, payload.class_name, payload.enrollment_school, payload.hukou_address,
      payload.father_name, payload.father_phone, payload.father_job, payload.mother_name, payload.mother_phone, payload.mother_job,
      payload.latest_exam_name, payload.total_score, payload.grade_rank, payload.class_rank,
      payload.chinese_score, payload.math_score, payload.english_score, payload.physics_score, payload.chemistry_score, payload.politics_score,
      payload.history_score, payload.geography_score, payload.biology_score,
      JSON.stringify(payload.exam_history || []), payload.competitions, payload.honors, payload.class_roles, payload.subject_strengths, payload.specialties,
      payload.self_evaluation, payload.reading_notes, JSON.stringify(payload.recommended_students || []),
      payload.profile_status || '待完善', payload.is_submitted ? 1 : 0, payload.contact_status || '未联系',
      current?.tier_level || autoTier,
      req.user.studentId, req.user.parentId,
    ]
  );

  const updated = await db.get('SELECT * FROM students WHERE id = ?', [req.user.studentId]);
  res.json(normalizeStudent(updated));
});

app.get('/api/admin/students', verifyToken, requireRole('admin'), async (req, res) => {
  const { school, tier_level, is_contacted, is_visited, owner_name, intent_level, min_total_score, max_total_score, max_grade_rank, max_class_rank } = req.query;
  const db = await getDb();

  const where = [];
  const params = [];
  if (school) { where.push('current_school = ?'); params.push(school); }
  if (tier_level) { where.push('tier_level = ?'); params.push(tier_level); }
  if (intent_level) { where.push('intent_level = ?'); params.push(intent_level); }
  if (owner_name) { where.push('owner_name = ?'); params.push(owner_name); }
  if (is_contacted !== undefined && is_contacted !== '') { where.push('is_contacted = ?'); params.push(Number(is_contacted)); }
  if (is_visited !== undefined && is_visited !== '') { where.push('is_visited = ?'); params.push(Number(is_visited)); }
  if (min_total_score) { where.push('total_score >= ?'); params.push(Number(min_total_score)); }
  if (max_total_score) { where.push('total_score <= ?'); params.push(Number(max_total_score)); }
  if (max_grade_rank) { where.push('grade_rank <= ?'); params.push(Number(max_grade_rank)); }
  if (max_class_rank) { where.push('class_rank <= ?'); params.push(Number(max_class_rank)); }

  const sql = `SELECT * FROM students ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY updated_at DESC`;
  const rows = await db.all(sql, params);
  res.json(rows.map(normalizeStudent));
});

app.get('/api/admin/students/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const db = await getDb();
  const student = await db.get('SELECT * FROM students WHERE id = ?', [req.params.id]);
  const followUps = await db.all('SELECT * FROM follow_up_records WHERE student_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json({ student: normalizeStudent(student), followUps });
});

app.put('/api/admin/students/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const allowed = ['tier_level', 'intent_level', 'parent_attitude', 'is_contacted', 'is_visited', 'visit_time', 'owner_name', 'next_follow_up_time', 'key_notes', 'risk_points', 'recommendation_value', 'contact_status'];
  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!entries.length) return res.status(400).json({ message: '无可更新字段' });

  const setSql = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);

  const db = await getDb();
  await db.run(`UPDATE students SET ${setSql}, updated_at=CURRENT_TIMESTAMP WHERE id = ?`, [...values, req.params.id]);
  const student = await db.get('SELECT * FROM students WHERE id = ?', [req.params.id]);
  res.json(normalizeStudent(student));
});

app.post('/api/admin/students/:id/follow-ups', verifyToken, requireRole('admin'), async (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ message: '请输入跟进内容' });

  const db = await getDb();
  await db.run('INSERT INTO follow_up_records (student_id, note, created_by) VALUES (?, ?, ?)', [req.params.id, note, req.user.displayName]);
  const list = await db.all('SELECT * FROM follow_up_records WHERE student_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json(list);
});

app.get('/api/admin/export', verifyToken, requireRole('admin'), async (_, res) => {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM students ORDER BY updated_at DESC');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('招生数据');
  sheet.columns = [
    { header: '学生姓名', key: 'name', width: 14 },
    { header: '学校', key: 'current_school', width: 20 },
    { header: '总分', key: 'total_score', width: 10 },
    { header: '年级排名', key: 'grade_rank', width: 10 },
    { header: '班级排名', key: 'class_rank', width: 10 },
    { header: '招生等级', key: 'tier_level', width: 12 },
    { header: '意向强度', key: 'intent_level', width: 12 },
    { header: '是否联系', key: 'is_contacted', width: 10 },
    { header: '是否来校', key: 'is_visited', width: 10 },
    { header: '负责人', key: 'owner_name', width: 12 },
    { header: '关键备注', key: 'key_notes', width: 30 },
  ];

  rows.forEach((row) => sheet.addRow(row));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="admission_students.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
