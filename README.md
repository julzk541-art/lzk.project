# 招生学生信息采集与后台筛选系统（MVP）

本项目是一个可本地运行的 MVP，包含：
- 家长端（二维码进入后可登录填写/更新学生信息）
- 招生后台（筛选、分层、跟进、导出 Excel）

## 1. 项目目录结构

```bash
lzk.project/
  backend/
    package.json
    src/
      index.js        # Express API
      db.js           # SQLite 建表与初始化
      auth.js         # JWT 鉴权
      tier.js         # 自动分层规则
  frontend/
    package.json
    index.html
    vite.config.js
    src/
      App.jsx
      styles.css
      services/api.js
      pages/
        LoginPage.jsx
        ParentPage.jsx
        AdminPage.jsx
```

## 2. 数据库设计（SQLite）

核心表：
- `parent_users`：家长登录信息（手机号 + 学生姓名）
- `admin_users`：管理员账号
- `students`：学生资料 + 后台隐藏字段
- `follow_up_records`：跟进记录

> SQLite 结构已尽量与 MySQL/PostgreSQL 通用（标准字段 + JSON 文本），后续迁移只需替换 DB driver 和 SQL 细节。

## 3. 功能覆盖

### 家长端
- 手机号 + 学生姓名模拟登录
- 填写基础信息 / 家长联系方式 / 成绩 / 荣誉特长 / 推荐同学
- 保存草稿 + 提交
- 查看状态：待完善 / 已提交 / 老师已联系

### 后台端
- 管理员/老师登录（默认：admin / 123456、teacher / 123456）
- 学生总表
- 条件筛选（学校、排名、分数区间、等级、是否联系、是否来校、负责人、意向）
- 学生详情 + 后台字段维护
- 跟进记录新增
- Excel 导出

### 自动分层
- 年级前30 或总分565+ => 特优生
- 年级前50 或班级前3 或总分550+ => 一批预录
- 年级前100 或班级前10 或总分530~549 => 二等预录
- 其他 => 待观察
- 老师可在后台手动修改分层

## 4. 本地运行步骤

### 4.1 启动后端
```bash
cd backend
npm install
npm run dev
```
默认地址：`http://localhost:4000`

### 4.2 启动前端
```bash
cd frontend
npm install
npm run dev
```
默认地址：`http://localhost:5173`

## 测试账号（开箱即用）

- 管理员：`admin / 123456`
- 招生老师：`teacher / 123456`
- 家长测试：手机号 `13800000000` + 学生姓名 `张三`

## Windows 一键启动（PowerShell）

在项目根目录可使用以下脚本：

- `start-backend.ps1`：安装并启动后端
- `start-frontend.ps1`：安装并启动前端
- `start-all.ps1`：自动打开两个 PowerShell 窗口分别启动前后端

示例：

```powershell
# 首次安装依赖并启动（推荐）
powershell -ExecutionPolicy Bypass -File .\start-all.ps1

# 已安装依赖时跳过 npm install
powershell -ExecutionPolicy Bypass -File .\start-all.ps1 -SkipInstall
```

## 5. API 概览

- `POST /api/auth/parent-login`
- `POST /api/auth/admin-login`
- `GET /api/parent/student`
- `PUT /api/parent/student`
- `GET /api/admin/students`
- `GET /api/admin/students/:id`
- `PUT /api/admin/students/:id`
- `POST /api/admin/students/:id/follow-ups`
- `GET /api/admin/export`

## 6. 后续扩展建议

1. 登录升级：接入短信验证码 / 微信 OAuth。
2. 数据层升级：抽象 Repository 层，替换 SQLite 为 MySQL/PostgreSQL。
3. 前端体验：把家长端拆成多步骤表单（基础信息、成绩、荣誉等）。
4. 权限系统：后台增加角色权限与操作日志。
5. 质量保障：增加参数校验（zod/joi）、单元测试与 E2E 测试。
