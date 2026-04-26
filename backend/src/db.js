import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;

export async function getDb() {
  if (!db) {
    db = await open({
      filename: './data.sqlite',
      driver: sqlite3.Database,
    });
    await initSchema(db);
  }
  return db;
}

async function initSchema(database) {
  await database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS parent_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      student_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(phone, student_name)
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      gender TEXT,
      birth_month TEXT,
      current_school TEXT,
      class_name TEXT,
      enrollment_school TEXT,
      hukou_address TEXT,

      father_name TEXT,
      father_phone TEXT,
      father_job TEXT,
      mother_name TEXT,
      mother_phone TEXT,
      mother_job TEXT,

      latest_exam_name TEXT,
      total_score REAL,
      grade_rank INTEGER,
      class_rank INTEGER,
      chinese_score REAL,
      math_score REAL,
      english_score REAL,
      physics_score REAL,
      chemistry_score REAL,
      politics_score REAL,
      history_score REAL,
      geography_score REAL,
      biology_score REAL,

      exam_history_json TEXT DEFAULT '[]',
      competitions TEXT,
      honors TEXT,
      class_roles TEXT,
      subject_strengths TEXT,
      specialties TEXT,
      self_evaluation TEXT,
      reading_notes TEXT,
      recommended_students_json TEXT DEFAULT '[]',

      profile_status TEXT DEFAULT '待完善',
      is_submitted INTEGER DEFAULT 0,
      contact_status TEXT DEFAULT '未联系',

      tier_level TEXT,
      intent_level TEXT DEFAULT '未沟通',
      parent_attitude TEXT DEFAULT '未沟通',
      is_contacted INTEGER DEFAULT 0,
      is_visited INTEGER DEFAULT 0,
      visit_time TEXT,
      owner_name TEXT,
      next_follow_up_time TEXT,
      key_notes TEXT,
      risk_points TEXT,
      recommendation_value TEXT,

      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(parent_user_id) REFERENCES parent_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS follow_up_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
  `);

  await database.run(
    `INSERT OR IGNORE INTO admin_users (username, password, display_name)
     VALUES ('admin', '123456', '招生管理员')`
  );

  await database.run(
    `INSERT OR IGNORE INTO admin_users (username, password, display_name)
     VALUES ('teacher', '123456', '招生老师')`
  );

  await database.run(
    `INSERT OR IGNORE INTO parent_users (phone, student_name)
     VALUES ('13800000000', '张三')`
  );

  const parent = await database.get(
    `SELECT id FROM parent_users WHERE phone = '13800000000' AND student_name = '张三'`
  );

  if (parent) {
    await database.run(
      `INSERT OR IGNORE INTO students (
        id, parent_user_id, name, current_school, class_name, profile_status, is_submitted
      ) VALUES (1, ?, '张三', '示例中学', '初三(1)班', '待完善', 0)`,
      [parent.id]
    );
  }
}
