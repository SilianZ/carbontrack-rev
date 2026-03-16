# CarbonTrack (Developer Branch)

面向开发者的快速上手文档：在本地启动前后端并完成基础测试。

## 1) 项目结构

这是一个 monorepo，包含两部分：

- `backend/`: PHP + Slim API 服务
- `frontend/`: React + Vite 单页应用

前后端通过 REST API 通信，接口主前缀为 `/api/v1`。

## 2) 环境要求

- PHP `>= 8.1`（项目 `composer.json` 最低写的是 7.4，但建议按团队开发环境使用 8.1+）
- Composer（后端依赖管理）
- MySQL（建议 5.7+ / 8.0+）
- Node.js `>= 20.9.0`
- pnpm `>= 10.4.1`

可先验证：

```bash
php -v
composer -V
mysql --version
node -v
pnpm -v
```

## 3) 一次性初始化

在仓库根目录执行。

### 3.1 后端初始化

```bash
cd backend
composer install
cp .env.example .env
```

编辑 `backend/.env`，至少确认以下变量可用：

- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`

初始化数据库：

```bash
# 1) 创建数据库（如已存在可跳过）
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS carbontrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2) 导入表结构与基础数据
mysql -u root -p carbontrack < backend/database/localhost.sql
```

### 3.2 前端初始化

```bash
cd frontend
pnpm install
cp .env.example .env
```

建议在 `frontend/.env` 显式设置本地 API：

```env
VITE_API_URL=http://localhost:8080/api/v1
```

## 4) 本地运行

使用两个终端分别启动后端和前端。

### 终端 A（后端）

```bash
cd backend
composer start
```

默认监听：`http://localhost:8080`

### 终端 B（前端）

```bash
cd frontend
pnpm dev
```

默认访问：`http://localhost:5173`

## 5) 测试与质量检查

在仓库根目录分别执行。

### 后端测试

```bash
cd backend
composer test
```

### 前端检查

```bash
cd frontend
pnpm lint
pnpm build
```

## 6) 快速验证

- 打开前端：`http://localhost:5173`
- 访问后端健康接口：`http://localhost:8080/api/v1/health`

如果前端能打开且 API 返回成功，说明本地链路可用。

## 7) 常见问题排查

### `zsh: command not found: composer`

你还未安装 Composer，先安装后重开终端再执行 `composer -V` 验证。

### `zsh: command not found: pnpm`

优先使用 Corepack：

```bash
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm -v
```

若 `corepack` 不可用，再使用：

```bash
npm install -g pnpm@10.4.1
```

### `cd: no such file or directory: backend`

通常是已经在 `backend` 目录里又执行了一次 `cd backend`。先用 `pwd` 确认当前位置。

### 数据库连接失败 / 500

检查 `backend/.env` 的数据库配置是否与本机 MySQL 一致，并确认数据库已导入 `backend/database/localhost.sql`。

### 前端请求 404（API 路径）

确保 `VITE_API_URL` 带有 `/api/v1` 前缀，例如：`http://localhost:8080/api/v1`。

## 8) 更多说明

- 详细环境配置：`SETUP.md`
- 同步与仓库策略：`SYNC_SETUP.md`