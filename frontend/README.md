# frontend

## API 基础地址配置（重要）

前端会优先读取 `VITE_API_URL`，否则在 Cloudflare Pages 构建时按 `CF_PAGES_BRANCH` 自动选择后端 API：

```
main/master -> https://api.carbontrackapp.com/api/v1
dev         -> https://dev-api.carbontrackapp.com/api/v1
其他分支     -> https://mig-api.carbontrackapp.com/api/v1
```

说明：
- 本地开发若未设置 `VITE_API_URL`，默认回退到 `https://dev-api.carbontrackapp.com/api/v1`。
- 如需手动覆盖，仍可在 `.env` 中显式设置 `VITE_API_URL`。
- 后端主要在版本化前缀下提供接口，即 `/api/v1/...`。
- 为了兼容历史调用，后端提供少量 `/api/...` 的别名路由；但为了避免未来的不一致，强烈建议始终使用 `/api/v1` 作为前缀。
- 前端会对 `VITE_API_URL` 做一次轻量规范化：如果你误将其配置为以 `/api` 结尾（如 `https://example.com/api`），前端会自动补全为 `https://example.com/api/v1`，以避免在未开启别名路由的环境出现 404。为清晰与稳定，仍建议显式配置到 `/api/v1`。

## Cloudflare Turnstile 验证码

本前端已内置 Turnstile 组件并接入登录与注册表单。

- 环境变量：在项目根目录下创建 `.env` 并配置：

```
VITE_TURNSTILE_SITE_KEY=你的_site_key
```

- 开发模式：若未配置 `VITE_TURNSTILE_SITE_KEY`，组件会展示提示且不渲染验证码（允许继续调试表单）。
- 生产模式：请务必配置真实的 `VITE_TURNSTILE_SITE_KEY`，否则按钮会被禁用，无法提交。

前端文件：
- `src/components/common/Turnstile.jsx` 负责脚本加载与渲染；提供 `onVerify` 回调以获取 token。
- `src/components/auth/LoginForm.jsx`、`RegisterForm.jsx` 已集成 Turnstile，并在提交请求时携带 `cf_turnstile_response` 字段。

后端约定：
- 接口接受 `cf_turnstile_response` 字段（或 `X-Turnstile-Token` 头）进行校验。

## Onboarding（入门引导）行为说明

- 当用户已登录但缺少 `school_id` 时，受保护路由将引导至 `/onboarding` 完善资料（`class_name` 字段已弃用）。
- 用户可点击“暂时跳过”，本次会话内将设置 `sessionStorage.onboarding_skipped = '1'`，从而允许继续访问其它页面；成功保存资料后会清除此标记。
- 登录与退出登录会清理该标记，避免在新会话延续跳过状态。
- 学校创建接口需要登录态（携带 `Authorization: Bearer <token>`），否则会返回 401；获取学校列表为公开接口。

## Admin 区域（管理员后台）

本项目前端已将 `/admin` 页面拆分为嵌套路由结构，只有具备管理员权限（`user.is_admin = true`）的登录用户可访问。

- 访问入口：
	- 登录后，导航栏用户菜单中会出现“Admin/管理员后台”入口，点击跳转 `/admin`。
	- 直接访问 `/admin` 时会自动重定向到 `/admin/dashboard`。

- 路由结构（已懒加载）：
	- `/admin/dashboard` 管理仪表盘（统计卡片、趋势图、手动刷新/自动轮询、卡片点击跳转等）。
	- `/admin/users` 用户运维（搜索、编辑、积分增减等）。
	- `/admin/activities` 活动审核（提交记录查看、预览、通过/驳回）。
	- `/admin/products` 商品管理（增删改查）。
	- `/admin/exchanges` 兑换管理（状态流转、备注）。
	- `/admin/broadcast` 广播中心（站内系统消息群发）。

- 主要文件：
	- 布局与导航：`src/components/layout/AdminLayout.jsx`（顶部标题 + Tab 导航 + `<Outlet />`）。
	- 路由定义：`src/router/index.jsx`（`/admin` 使用 `AdminRoute` 做管理员鉴权，并挂载各子页）。
	- 子页面：`src/pages/admin/*.jsx`（Dashboard、Users、Activities、Products、Exchanges、Broadcast）。

- 鉴权说明：
	- 由 `src/components/auth/ProtectedRoute.jsx` 提供的 `AdminRoute` 组件实现，仅 `is_admin` 用户可访问。
	- 若用户资料缺少 `school_id`，受保护路由会先引导到 `/onboarding` 完善资料（支持本会话临时跳过）。

- 后端接口：
	- 统计数据：`GET /admin/stats`（已修复与数据库结构对齐，`total_carbon_saved` 来自 `carbon_records` 聚合）。
	- 其它接口详见后端 README 或 `src/lib/api.js` 中的 `adminAPI` 封装。

- 开发/调试建议：
	- 确保 `.env` 中 `VITE_API_URL` 指向正确的后端地址（建议以 `/api/v1` 结尾）。
	- 本地快速预览：`pnpm dev` 启动后端与前端，再用管理员账号登录访问 `/admin`。

---
E2E sync test note: updating this file to trigger the monorepo -> repo sync workflow on 2025-10-27.
E2E sync test trigger 2: retrigger bootstrap PR creation (2025-10-27).
E2E sync test trigger 3: retrigger after path fixes (2025-10-27).
\nE2E sync test trigger 3: retrigger after path fixes (2025-10-27).\n
\nE2E sync test trigger 4: ensure bootstrap clones kept (2025-10-27).\n

E2E manual test trigger by user at 2025-10-27T12:13:25.5966618+08:00


E2E manual test trigger by user at 2025-10-27T12:13:41.9177827+08:00

