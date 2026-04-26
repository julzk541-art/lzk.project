import express from 'express';
import cors from 'cors';
import ExcelJS from 'exceljs';
import multer from 'multer';
import { getDb } from './db.js';
import { signToken, verifyToken, requireRole } from './auth.js';
import { calcAutoTier } from './tier.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage() });

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

function toBool(v) {
  if (v === undefined || v === null || v === '') return null;
  if (v === true || v === '1' || v === 1 || v === '是') return 1;
  if (v === false || v === '0' || v === 0 || v === '否') return 0;
  return null;
}

function buildStudentWhere(query = {}) {
  const {
    school,
    student_name,
    phone,
    profile_status,
    tier_level,
    is_contacted,
    is_visited,
    owner_name,
    intent_level,
    min_total_score,
    max_total_score,
    max_grade_rank,
    max_class_rank,
  } = query;

  const where = [];
  const params = [];

  if (school) {
    where.push('s.current_school LIKE ?');
    params.push(`%${school}%`);
  }
  if (student_name) {
    where.push('s.name LIKE ?');
    params.push(`%${student_name}%`);
  }
  if (phone) {
    where.push('p.phone LIKE ?');
    params.push(`%${phone}%`);
  }
  if (profile_status) {
    where.push('s.profile_status = ?');
    params.push(profile_status);
  }
  if (tier_level) {
    where.push('s.tier_level = ?');
    params.push(tier_level);
  }
  if (intent_level) {
    where.push('s.intent_level = ?');
    params.push(intent_level);
  }
  if (owner_name) {
    where.push('s.owner_name LIKE ?');
    params.push(`%${owner_name}%`);
  }

  const contacted = toBool(is_contacted);
  if (contacted !== null) {
    where.push('s.is_contacted = ?');
    params.push(contacted);
  }

  const visited = toBool(is_visited);
  if (visited !== null) {
    where.push('s.is_visited = ?');
    params.push(visited);
  }

  if (min_total_score !== undefined && min_total_score !== '') {
    where.push('CAST(COALESCE(s.total_score, 0) AS REAL) >= ?');
    params.push(Number(min_total_score));
  }
  if (max_total_score !== undefined && max_total_score !== '') {
    where.push('CAST(COALESCE(s.total_score, 0) AS REAL) <= ?');
    params.push(Number(max_total_score));
  }
  if (max_grade_rank !== undefined && max_grade_rank !== '') {
    where.push('CAST(COALESCE(s.grade_rank, 999999) AS INTEGER) <= ?');
    params.push(Number(max_grade_rank));
  }
  if (max_class_rank !== undefined && max_class_rank !== '') {
    where.push('CAST(COALESCE(s.class_rank, 999999) AS INTEGER) <= ?');
    params.push(Number(max_class_rank));
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function listStudentsWithFilters(query) {
  const db = await getDb();
  const { whereSql, params } = buildStudentWhere(query);

  const rows = await db.all(
    `SELECT s.*, p.phone FROM students s
     JOIN parent_users p ON p.id = s.parent_user_id
     ${whereSql}
     ORDER BY datetime(s.updated_at) DESC`,
    params
  );

  return rows.map(normalizeStudent);
}

function calcStats(students) {
  return {
    total: students.length,
    submitted: students.filter((s) => s.profile_status === '已提交').length,
    pending: students.filter((s) => s.profile_status === '待完善').length,
    contactedStatus: students.filter((s) => s.profile_status === '老师已联系').length,
    elite: students.filter((s) => s.tier_level === '特优生').length,
    firstBatch: students.filter((s) => s.tier_level === '一批预录').length,
    secondBatch: students.filter((s) => s.tier_level === '二等预录').length,
    watch: students.filter((s) => s.tier_level === '待观察').length,
    contacted: students.filter((s) => Number(s.is_contacted) === 1).length,
    notContacted: students.filter((s) => Number(s.is_contacted) !== 1).length,
  };
}

async function upsertParentProfile(req, res, mode) {
  const db = await getDb();
  const payload = req.body || {};
  const current = await db.get('SELECT * FROM students WHERE id = ? AND parent_user_id = ?', [req.user.studentId, req.user.parentId]);
  if (!current) return res.status(404).json({ message: '学生档案不存在' });

  const targetStatus = mode === 'submit' ? '已提交' : '待完善';
  const isSubmitted = mode === 'submit' ? 1 : 0;

  const tierLevel = Number(current.tier_manual_override) === 1 ? current.tier_level : calcAutoTier(payload);

  await db.run(
    `UPDATE students SET
      name=?, gender=?, birth_month=?, current_school=?, class_name=?, enrollment_school=?, hukou_address=?,
      father_name=?, father_phone=?, father_job=?, mother_name=?, mother_phone=?, mother_job=?,
      latest_exam_name=?, total_score=?, grade_rank=?, class_rank=?,
      chinese_score=?, math_score=?, english_score=?, physics_score=?, chemistry_score=?, politics_score=?,
      history_score=?, geography_score=?, biology_score=?,
      exam_history_json=?, competitions=?, honors=?, class_roles=?, subject_strengths=?, specialties=?,
      self_evaluation=?, reading_notes=?, recommended_students_json=?,
      profile_status=?, is_submitted=?, submitted_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE submitted_at END,
      tier_level=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND parent_user_id=?`,
    [
      payload.name || current.name,
      payload.gender || null,
      payload.birth_month || null,
      payload.current_school || null,
      payload.class_name || null,
      payload.enrollment_school || null,
      payload.hukou_address || null,
      payload.father_name || null,
      payload.father_phone || null,
      payload.father_job || null,
      payload.mother_name || null,
      payload.mother_phone || null,
      payload.mother_job || null,
      payload.latest_exam_name || null,
      payload.total_score !== '' ? payload.total_score : null,
      payload.grade_rank !== '' ? payload.grade_rank : null,
      payload.class_rank !== '' ? payload.class_rank : null,
      payload.chinese_score !== '' ? payload.chinese_score : null,
      payload.math_score !== '' ? payload.math_score : null,
      payload.english_score !== '' ? payload.english_score : null,
      payload.physics_score !== '' ? payload.physics_score : null,
      payload.chemistry_score !== '' ? payload.chemistry_score : null,
      payload.politics_score !== '' ? payload.politics_score : null,
      payload.history_score !== '' ? payload.history_score : null,
      payload.geography_score !== '' ? payload.geography_score : null,
      payload.biology_score !== '' ? payload.biology_score : null,
      JSON.stringify(Array.isArray(payload.exam_history) ? payload.exam_history : []),
      payload.competitions || null,
      payload.honors || null,
      payload.class_roles || null,
      payload.subject_strengths || null,
      payload.specialties || null,
      payload.self_evaluation || null,
      payload.reading_notes || null,
      JSON.stringify(Array.isArray(payload.recommended_students) ? payload.recommended_students : []),
      targetStatus,
      isSubmitted,
      isSubmitted,
      tierLevel,
      req.user.studentId,
      req.user.parentId,
    ]
  );

  const updated = await db.get(
    `SELECT s.*, p.phone FROM students s
     JOIN parent_users p ON p.id = s.parent_user_id
     WHERE s.id = ?`,
    [req.user.studentId]
  );

  res.json({
    message: mode === 'submit' ? '资料提交成功，后续可继续登录补充或修改。' : '草稿已保存，下次登录可继续修改。',
    student: normalizeStudent(updated),
  });
}

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/parent/login', async (req, res) => {
  const { phone, studentName } = req.body;
  if (!phone || !studentName) return res.status(400).json({ message: '请输入手机号和学生姓名' });

  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO parent_users (phone, student_name) VALUES (?, ?)', [phone, studentName]);
  const parent = await db.get('SELECT * FROM parent_users WHERE phone = ? AND student_name = ?', [phone, studentName]);

  let student = await db.get('SELECT * FROM students WHERE parent_user_id = ?', [parent.id]);
  if (!student) {
    await db.run('INSERT INTO students (parent_user_id, name, tier_level) VALUES (?, ?, ?)', [parent.id, studentName, '待观察']);
    student = await db.get('SELECT * FROM students WHERE parent_user_id = ?', [parent.id]);
  }

  const token = signToken({ role: 'parent', parentId: parent.id, studentId: student.id, name: parent.student_name });
  res.json({ token, student: normalizeStudent(student) });
});

app.post('/api/auth/parent-login', async (req, res) => {
  const { phone, studentName } = req.body;
  if (!phone || !studentName) return res.status(400).json({ message: '请输入手机号和学生姓名' });

  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO parent_users (phone, student_name) VALUES (?, ?)', [phone, studentName]);
  const parent = await db.get('SELECT * FROM parent_users WHERE phone = ? AND student_name = ?', [phone, studentName]);

  let student = await db.get('SELECT * FROM students WHERE parent_user_id = ?', [parent.id]);
  if (!student) {
    await db.run('INSERT INTO students (parent_user_id, name, tier_level) VALUES (?, ?, ?)', [parent.id, studentName, '待观察']);
    student = await db.get('SELECT * FROM students WHERE parent_user_id = ?', [parent.id]);
  }

  const token = signToken({ role: 'parent', parentId: parent.id, studentId: student.id, name: parent.student_name });
  res.json({ token, student: normalizeStudent(student) });
});

app.post('/api/admin/login', async (req, res) => {
  const { phone, name, password } = req.body;
  if (!phone || !name || !password) return res.status(400).json({ message: '请填写手机号、姓名和密码' });
  const db = await getDb();
  const admin = await db.get(
    'SELECT * FROM admin_users WHERE phone = ? AND display_name = ? AND password = ?',
    [phone, name, password]
  );
  if (!admin) return res.status(401).json({ message: '手机号、姓名或密码错误' });

  const token = signToken({ role: 'admin', adminId: admin.id, displayName: admin.display_name });
  res.json({ token, displayName: admin.display_name });
});

app.post('/api/auth/admin-login', async (req, res) => {
  const { phone, name, password } = req.body;
  const db = await getDb();
  const admin = await db.get(
    'SELECT * FROM admin_users WHERE phone = ? AND display_name = ? AND password = ?',
    [phone, name, password]
  );
  if (!admin) return res.status(401).json({ message: '手机号、姓名或密码错误' });

  const token = signToken({ role: 'admin', adminId: admin.id, displayName: admin.display_name });
  res.json({ token, displayName: admin.display_name });
});

app.get('/api/parent/profile', verifyToken, requireRole('parent'), async (req, res) => {
  const db = await getDb();
  const student = await db.get(
    `SELECT s.*, p.phone FROM students s
     JOIN parent_users p ON p.id = s.parent_user_id
     WHERE s.id = ? AND s.parent_user_id = ?`,
    [req.user.studentId, req.user.parentId]
  );
  res.json(normalizeStudent(student));
});

app.put('/api/parent/profile/save-draft', verifyToken, requireRole('parent'), async (req, res) => {
  await upsertParentProfile(req, res, 'draft');
});

app.put('/api/parent/profile/submit', verifyToken, requireRole('parent'), async (req, res) => {
  await upsertParentProfile(req, res, 'submit');
});

app.get('/api/parent/student', verifyToken, requireRole('parent'), async (req, res) => {
  const db = await getDb();
  const student = await db.get(
    `SELECT s.*, p.phone FROM students s
     JOIN parent_users p ON p.id = s.parent_user_id
     WHERE s.id = ? AND s.parent_user_id = ?`,
    [req.user.studentId, req.user.parentId]
  );
  res.json(normalizeStudent(student));
});

app.put('/api/parent/student', verifyToken, requireRole('parent'), async (req, res) => {
  await upsertParentProfile(req, res, req.body?.is_submitted ? 'submit' : 'draft');
});

app.get('/api/admin/students', verifyToken, requireRole('admin'), async (req, res) => {
  const students = await listStudentsWithFilters(req.query);
  const parentUrl = process.env.PUBLIC_PARENT_URL || process.env.VITE_PUBLIC_PARENT_URL || 'http://localhost:5173';
  res.json({ students, stats: calcStats(students), parentUrl });
});

app.get('/api/admin/students/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const db = await getDb();
  const student = await db.get(
    `SELECT s.*, p.phone FROM students s
     JOIN parent_users p ON p.id = s.parent_user_id
     WHERE s.id = ?`,
    [req.params.id]
  );
  if (!student) return res.status(404).json({ message: '学生不存在' });

  const followUps = await db.all('SELECT * FROM follow_up_records WHERE student_id = ? ORDER BY datetime(created_at) DESC', [req.params.id]);
  res.json({ student: normalizeStudent(student), followUps });
});

app.put('/api/admin/students/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const db = await getDb();
  const current = await db.get('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!current) return res.status(404).json({ message: '学生不存在' });

  const allowed = [
    'profile_status', 'tier_level', 'intent_level', 'parent_attitude', 'is_contacted', 'is_visited', 'visit_time',
    'owner_name', 'next_follow_up_time', 'key_notes', 'risk_points', 'recommendation_value', 'contact_status',
    'total_score', 'grade_rank', 'class_rank'
  ];

  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!entries.length) return res.status(400).json({ message: '无可更新字段' });

  const values = entries.map(([, v]) => v);

  let tierManualOverride = current.tier_manual_override;
  if (Object.prototype.hasOwnProperty.call(req.body, 'tier_level')) {
    tierManualOverride = 1;
  } else if (
    ['total_score', 'grade_rank', 'class_rank'].some((k) => Object.prototype.hasOwnProperty.call(req.body, k)) &&
    Number(current.tier_manual_override) !== 1
  ) {
    const tier = calcAutoTier({ ...current, ...req.body });
    entries.push(['tier_level', tier]);
    values.push(tier);
  }

  const setSql = entries.map(([k]) => `${k} = ?`).join(', ');

  await db.run(
    `UPDATE students SET ${setSql}, tier_manual_override = ?, updated_at=CURRENT_TIMESTAMP WHERE id = ?`,
    [...values, tierManualOverride, req.params.id]
  );

  const student = await db.get(
    `SELECT s.*, p.phone FROM students s
     JOIN parent_users p ON p.id = s.parent_user_id
     WHERE s.id = ?`,
    [req.params.id]
  );
  res.json(normalizeStudent(student));
});

app.post('/api/admin/students/:id/followups', verifyToken, requireRole('admin'), async (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ message: '请输入跟进内容' });

  const db = await getDb();
  await db.run('INSERT INTO follow_up_records (student_id, note, created_by) VALUES (?, ?, ?)', [req.params.id, note, req.user.displayName]);
  const list = await db.all('SELECT * FROM follow_up_records WHERE student_id = ? ORDER BY datetime(created_at) DESC', [req.params.id]);
  res.json(list);
});

app.post('/api/admin/students/:id/follow-ups', verifyToken, requireRole('admin'), async (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ message: '请输入跟进内容' });

  const db = await getDb();
  await db.run('INSERT INTO follow_up_records (student_id, note, created_by) VALUES (?, ?, ?)', [req.params.id, note, req.user.displayName]);
  const list = await db.all('SELECT * FROM follow_up_records WHERE student_id = ? ORDER BY datetime(created_at) DESC', [req.params.id]);
  res.json(list);
});

app.get('/api/admin/export', verifyToken, requireRole('admin'), async (req, res) => {
  const rows = await listStudentsWithFilters(req.query);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('优秀生信息');
  sheet.columns = [
    { header: '学生姓名', key: 'name', width: 14 },
    { header: '手机号', key: 'phone', width: 14 },
    { header: '性别', key: 'gender', width: 8 },
    { header: '出生年月', key: 'birth_month', width: 12 },
    { header: '就读学校', key: 'current_school', width: 16 },
    { header: '班级', key: 'class_name', width: 12 },
    { header: '学籍学校', key: 'enrollment_school', width: 16 },
    { header: '户籍地址', key: 'hukou_address', width: 24 },
    { header: '父亲姓名', key: 'father_name', width: 12 },
    { header: '父亲电话', key: 'father_phone', width: 14 },
    { header: '父亲单位及职务', key: 'father_job', width: 20 },
    { header: '母亲姓名', key: 'mother_name', width: 12 },
    { header: '母亲电话', key: 'mother_phone', width: 14 },
    { header: '母亲单位及职务', key: 'mother_job', width: 20 },
    { header: '最近一次考试名称', key: 'latest_exam_name', width: 18 },
    { header: '总分', key: 'total_score', width: 10 },
    { header: '年级排名', key: 'grade_rank', width: 10 },
    { header: '班级排名', key: 'class_rank', width: 10 },
    { header: '语文', key: 'chinese_score', width: 8 },
    { header: '数学', key: 'math_score', width: 8 },
    { header: '英语', key: 'english_score', width: 8 },
    { header: '物理', key: 'physics_score', width: 8 },
    { header: '化学', key: 'chemistry_score', width: 8 },
    { header: '政治', key: 'politics_score', width: 8 },
    { header: '历史', key: 'history_score', width: 8 },
    { header: '地理', key: 'geography_score', width: 8 },
    { header: '生物', key: 'biology_score', width: 8 },
    { header: '竞赛经历', key: 'competitions', width: 20 },
    { header: '荣誉奖励', key: 'honors', width: 20 },
    { header: '班干部经历', key: 'class_roles', width: 20 },
    { header: '学科优势', key: 'subject_strengths', width: 20 },
    { header: '特长', key: 'specialties', width: 20 },
    { header: '自我评价', key: 'self_evaluation', width: 20 },
    { header: '阅读情况', key: 'reading_notes', width: 20 },
    { header: '推荐同学', key: 'recommended_students_text', width: 26 },
    { header: '当前状态', key: 'profile_status', width: 12 },
    { header: '分层等级', key: 'tier_level', width: 12 },
    { header: '意向强度', key: 'intent_level', width: 12 },
    { header: '家长态度', key: 'parent_attitude', width: 12 },
    { header: '是否联系', key: 'is_contacted_text', width: 10 },
    { header: '是否来校', key: 'is_visited_text', width: 10 },
    { header: '来校时间', key: 'visit_time', width: 14 },
    { header: '负责人', key: 'owner_name', width: 12 },
    { header: '下次跟进时间', key: 'next_follow_up_time', width: 16 },
    { header: '关键备注', key: 'key_notes', width: 24 },
    { header: '风险点', key: 'risk_points', width: 24 },
    { header: '推荐价值', key: 'recommendation_value', width: 14 },
    { header: '提交时间', key: 'submitted_at', width: 16 },
    { header: '更新时间', key: 'updated_at', width: 16 },
  ];

  rows.forEach((row) => {
    sheet.addRow({
      ...row,
      recommended_students_text: Array.isArray(row.recommended_students)
        ? row.recommended_students.map((r) => `${r.name || ''}${r.phone ? `(${r.phone})` : ''}`).join('；')
        : '',
      is_contacted_text: Number(row.is_contacted) === 1 ? '是' : '否',
      is_visited_text: Number(row.is_visited) === 1 ? '是' : '否',
    });
  });

  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="优秀生信息名单_${ymd}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

app.get('/api/admin/import-template', verifyToken, requireRole('admin'), async (_, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('导入模板');
  sheet.columns = [
    { header: '学生姓名', key: 'name', width: 14 },
    { header: '手机号', key: 'phone', width: 14 },
    { header: '性别', key: 'gender', width: 8 },
    { header: '出生年月', key: 'birth_month', width: 12 },
    { header: '就读学校', key: 'current_school', width: 16 },
    { header: '班级', key: 'class_name', width: 12 },
    { header: '总分', key: 'total_score', width: 10 },
    { header: '年级排名', key: 'grade_rank', width: 10 },
    { header: '班级排名', key: 'class_rank', width: 10 },
    { header: '当前状态', key: 'profile_status', width: 12 },
    { header: '分层等级', key: 'tier_level', width: 12 },
    { header: '是否联系', key: 'is_contacted', width: 10 },
    { header: '是否来校', key: 'is_visited', width: 10 },
    { header: '负责人', key: 'owner_name', width: 12 },
  ];
  sheet.addRow({
    name: '张三',
    phone: '13800000000',
    gender: '男',
    current_school: '示例中学',
    class_name: '初三(1)班',
    total_score: 560,
    grade_rank: 40,
    class_rank: 2,
    profile_status: '已提交',
    tier_level: '一批预录',
    is_contacted: '否',
    is_visited: '否',
    owner_name: '李兆康',
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="优秀生导入模板.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

const importMap = {
  学生姓名: 'name',
  手机号: 'phone',
  性别: 'gender',
  出生年月: 'birth_month',
  就读学校: 'current_school',
  班级: 'class_name',
  学籍学校: 'enrollment_school',
  户籍地址: 'hukou_address',
  父亲姓名: 'father_name',
  父亲电话: 'father_phone',
  父亲单位及职务: 'father_job',
  母亲姓名: 'mother_name',
  母亲电话: 'mother_phone',
  母亲单位及职务: 'mother_job',
  最近一次考试名称: 'latest_exam_name',
  总分: 'total_score',
  年级排名: 'grade_rank',
  班级排名: 'class_rank',
  语文: 'chinese_score',
  数学: 'math_score',
  英语: 'english_score',
  物理: 'physics_score',
  化学: 'chemistry_score',
  政治: 'politics_score',
  历史: 'history_score',
  地理: 'geography_score',
  生物: 'biology_score',
  竞赛经历: 'competitions',
  荣誉奖励: 'honors',
  班干部经历: 'class_roles',
  学科优势: 'subject_strengths',
  特长: 'specialties',
  自我评价: 'self_evaluation',
  阅读情况: 'reading_notes',
  当前状态: 'profile_status',
  分层等级: 'tier_level',
  意向强度: 'intent_level',
  家长态度: 'parent_attitude',
  是否联系: 'is_contacted',
  是否来校: 'is_visited',
  来校时间: 'visit_time',
  负责人: 'owner_name',
  下次跟进时间: 'next_follow_up_time',
  关键备注: 'key_notes',
  风险点: 'risk_points',
  推荐价值: 'recommendation_value',
};

app.post('/api/admin/import', verifyToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请上传 Excel 文件' });
  const db = await getDb();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return res.status(400).json({ message: '未读取到工作表' });

  const headerRow = sheet.getRow(1).values;
  const headers = headerRow.slice(1);
  const keys = headers.map((h) => importMap[String(h || '').trim()] || null);

  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (let i = 2; i <= sheet.rowCount; i += 1) {
    const row = sheet.getRow(i);
    const vals = row.values.slice(1);
    if (!vals.some((v) => String(v || '').trim())) continue;

    const data = {};
    keys.forEach((key, idx) => {
      if (!key) return;
      data[key] = vals[idx];
    });

    const name = String(data.name || '').trim();
    const phone = String(data.phone || '').trim();
    if (!name || !phone) {
      errors.push({ row: i, reason: '缺少学生姓名或手机号' });
      continue;
    }

    try {
      await db.run('INSERT OR IGNORE INTO parent_users (phone, student_name) VALUES (?, ?)', [phone, name]);
      const parent = await db.get('SELECT * FROM parent_users WHERE phone = ? AND student_name = ?', [phone, name]);
      const existing = await db.get('SELECT * FROM students WHERE parent_user_id = ?', [parent.id]);

      const normalizedContact = toBool(data.is_contacted);
      const normalizedVisit = toBool(data.is_visited);
      const computedTier = data.tier_level || calcAutoTier(data);

      if (existing) {
        await db.run(
          `UPDATE students SET
            gender=?, birth_month=?, current_school=?, class_name=?, enrollment_school=?, hukou_address=?,
            father_name=?, father_phone=?, father_job=?, mother_name=?, mother_phone=?, mother_job=?,
            latest_exam_name=?, total_score=?, grade_rank=?, class_rank=?,
            chinese_score=?, math_score=?, english_score=?, physics_score=?, chemistry_score=?, politics_score=?,
            history_score=?, geography_score=?, biology_score=?, competitions=?, honors=?, class_roles=?, subject_strengths=?,
            specialties=?, self_evaluation=?, reading_notes=?, profile_status=?, tier_level=?, intent_level=?, parent_attitude=?,
            is_contacted=?, is_visited=?, visit_time=?, owner_name=?, next_follow_up_time=?, key_notes=?, risk_points=?, recommendation_value=?,
            updated_at=CURRENT_TIMESTAMP
          WHERE id=?`,
          [
            data.gender || existing.gender,
            data.birth_month || existing.birth_month,
            data.current_school || existing.current_school,
            data.class_name || existing.class_name,
            data.enrollment_school || existing.enrollment_school,
            data.hukou_address || existing.hukou_address,
            data.father_name || existing.father_name,
            data.father_phone || existing.father_phone,
            data.father_job || existing.father_job,
            data.mother_name || existing.mother_name,
            data.mother_phone || existing.mother_phone,
            data.mother_job || existing.mother_job,
            data.latest_exam_name || existing.latest_exam_name,
            data.total_score ?? existing.total_score,
            data.grade_rank ?? existing.grade_rank,
            data.class_rank ?? existing.class_rank,
            data.chinese_score ?? existing.chinese_score,
            data.math_score ?? existing.math_score,
            data.english_score ?? existing.english_score,
            data.physics_score ?? existing.physics_score,
            data.chemistry_score ?? existing.chemistry_score,
            data.politics_score ?? existing.politics_score,
            data.history_score ?? existing.history_score,
            data.geography_score ?? existing.geography_score,
            data.biology_score ?? existing.biology_score,
            data.competitions ?? existing.competitions,
            data.honors ?? existing.honors,
            data.class_roles ?? existing.class_roles,
            data.subject_strengths ?? existing.subject_strengths,
            data.specialties ?? existing.specialties,
            data.self_evaluation ?? existing.self_evaluation,
            data.reading_notes ?? existing.reading_notes,
            data.profile_status || existing.profile_status || '待完善',
            computedTier || existing.tier_level,
            data.intent_level || existing.intent_level,
            data.parent_attitude || existing.parent_attitude,
            normalizedContact ?? existing.is_contacted ?? 0,
            normalizedVisit ?? existing.is_visited ?? 0,
            data.visit_time || existing.visit_time,
            data.owner_name || existing.owner_name,
            data.next_follow_up_time || existing.next_follow_up_time,
            data.key_notes || existing.key_notes,
            data.risk_points || existing.risk_points,
            data.recommendation_value || existing.recommendation_value,
            existing.id,
          ]
        );
        updated += 1;
      } else {
        await db.run(
          `INSERT INTO students (
            parent_user_id, name, gender, birth_month, current_school, class_name, enrollment_school, hukou_address,
            father_name, father_phone, father_job, mother_name, mother_phone, mother_job,
            latest_exam_name, total_score, grade_rank, class_rank, chinese_score, math_score, english_score, physics_score,
            chemistry_score, politics_score, history_score, geography_score, biology_score, competitions, honors, class_roles,
            subject_strengths, specialties, self_evaluation, reading_notes, profile_status, tier_level, intent_level, parent_attitude,
            is_contacted, is_visited, visit_time, owner_name, next_follow_up_time, key_notes, risk_points, recommendation_value, is_submitted, submitted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ?='已提交' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
          [
            parent.id, name, data.gender || null, data.birth_month || null, data.current_school || null, data.class_name || null, data.enrollment_school || null, data.hukou_address || null,
            data.father_name || null, data.father_phone || null, data.father_job || null, data.mother_name || null, data.mother_phone || null, data.mother_job || null,
            data.latest_exam_name || null, data.total_score ?? null, data.grade_rank ?? null, data.class_rank ?? null, data.chinese_score ?? null, data.math_score ?? null, data.english_score ?? null, data.physics_score ?? null,
            data.chemistry_score ?? null, data.politics_score ?? null, data.history_score ?? null, data.geography_score ?? null, data.biology_score ?? null, data.competitions ?? null, data.honors ?? null, data.class_roles ?? null,
            data.subject_strengths ?? null, data.specialties ?? null, data.self_evaluation ?? null, data.reading_notes ?? null, data.profile_status || '待完善', computedTier || '待观察', data.intent_level || '未沟通', data.parent_attitude || '未沟通',
            normalizedContact ?? 0, normalizedVisit ?? 0, data.visit_time || null, data.owner_name || null, data.next_follow_up_time || null, data.key_notes || null, data.risk_points || null, data.recommendation_value || null, data.profile_status === '已提交' ? 1 : 0, data.profile_status || '待完善',
          ]
        );
        inserted += 1;
      }
    } catch (error) {
      errors.push({ row: i, reason: error.message || '未知错误' });
    }
  }

  res.json({ inserted, updated, failed: errors.length, errors });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
