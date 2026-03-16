# CarbonTrack 项目全栈开发环境配置指南

本指南为新成员提供完整的全栈（前端 React + 后端 PHP）开发环境配置说明。

## 目录

- [环境要求](#环境要求)
- [项目获取](#项目获取)
- [后端配置 (PHP/Slim)](#后端配置-phpslim)
- [前端配置 (React/Vite)](#前端配置-reactvite)
- [启动运行](#启动运行)
- [技术栈概览](#技术栈概览)
- [常见问题](#常见问题)

---

## 环境要求

### 1. 基础工具
- **Git**: 版本控制
- **Visual Studio Code**: 推荐 IDE
  - 推荐插件：ESLint, Tailwind CSS, PHP Intelephense, Thunder Client (接口测试)

### 2. 后端要求 (PHP)
- **PHP**: v8.2+
- **Composer**: PHP 包管理器
- **MySQL**: 数据库（推荐 v5.7+ 或 v8.0+）

### 3. 前端要求 (Node.js)
- **Node.js**: v20.9+（推荐使用 Node 20 LTS，并与 CI 保持一致）
- **pnpm**: v10.4.1（必需，请勿使用 npm 或 yarn；CI 也固定此版本）
  - 安装：`npm install -g pnpm`

---

## 项目获取

```bash
# 克隆仓库
git clone <repository-url>
cd carbontrack_rev
```

---

## 后端配置 (PHP/Slim)

### 1. 安装依赖
进入 `backend` 目录并安装 PHP 扩展包：
```bash
cd backend
composer install
```

### 2. 环境变量配置
在 `backend` 根目录下创建 `.env` 文件（可参考 `.env.example`）：
```env
APP_ENV=development
APP_DEBUG=true

# 数据库配置
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=carbontrack
DB_USERNAME=root
DB_PASSWORD=your_password
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

# JWT 配置
JWT_SECRET=your_super_secret_key
JWT_ALGORITHM=HS256

# OpenAI 配置 (可选，用于 AI 功能)
OPENAI_API_KEY=your_openai_api_key

# 调试 Token (用于测试环境中绕过某些安全策略)
DEBUG_TOKEN=your_debug_token

# 邮件与应用标识
APP_NAME="CarbonTrack"
MAIL_FROM_ADDRESS=noreply@carbontrack.com
MAIL_FROM_NAME="CarbonTrack Support"
FRONTEND_URL=http://localhost:5173
```

### 3. 数据库初始化
1. **创建数据库**：在 MySQL 中创建名为 `carbontrack` 的数据库。
2. **导入基础结构**：执行 `database/localhost.sql` 以建立初始表结构和基础数据。

### 4. 运行后端预览
```bash
composer start
```
此时后端 API 将在 `http://localhost:8080` 运行。您可以访问 `http://localhost:8080/api/v1/health` 或类似端点确认。

---

## 前端配置 (React/Vite)

### 1. 安装依赖
进入 `frontend` 目录并安装 Node 依赖：
```bash
cd ../frontend
pnpm install
```

如果你使用 `nvm` / `fnm` / `asdf` 一类版本管理工具，建议先根据 `frontend/.nvmrc` 切换到 Node 20 再安装依赖。

### 2. 环境变量配置（可忽略，已提供默认值）
在 `frontend` 根目录下创建 `.env` 文件：
```env
# API 基础地址（必需，指向本地后端）
VITE_API_URL=http://localhost:8080/api/v1

# Cloudflare Turnstile 站点密钥（可选，开发环境可留空）
VITE_TURNSTILE_SITE_KEY=your_site_key
```

---

## 启动运行

### 方式 A：手动启动（推荐开发时使用）

1. **启动后端**（端口 8080）：
   ```bash
   cd backend
   composer start
   ```

2. **启动前端**（端口 5173）：
   ```bash
   cd frontend
   pnpm dev
   ```

### 方式 B：VS Code 任务
本项目已预配置 VS Code 任务，你可以通过 `Ctrl+Shift+B` 或 `Terminal -> Run Build Task` 同时运行前后端。

---

## 技术栈概览

### 后端 (Backend)
- **Framework**: Slim 4 (Micro-framework)
- **ORM**: Laravel Eloquent
- **Container**: PHP-DI
- **Auth**: JWT (Firebase JWT)
- **Validation**: Respect Validation
- **Logging**: Monolog + 自定义 AuditLog/ErrorLog 体系

### 前端 (Frontend)
- **Framework**: React 19 + Vite
- **UI**: Tailwind CSS 4 + shadcn/ui
- **State**: TanStack Query (React Query) + Zustand
- **Form**: React Hook Form + Zod
- **I18n**: i18next

---

## 常见问题

### 1. API 404 错误
- 确保 `VITE_API_URL` 包含 `/api/v1` 前缀。
- 检查后端服务器是否已启动。

### 2. 跨域 (CORS) 错误
- 后端开发模式下（`APP_ENV != production`）已自动放行 `localhost:5173`。
- 如果报错，请检查后端 `.env` 的 `APP_ENV` 设置。

### 3. 数据库连接失败
- 确保 MySQL 服务已运行，并检查 `backend/.env` 中的用户名和密码。

### 4. 样式不生效
- 检查是否运行了 `pnpm dev`。Tailwind 4 需要开发服务器处理样式。

---

**遇到问题？** 
请查阅各目录下的 `README.md` 或咨询团队成员。
