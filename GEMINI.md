---
trigger: always_on
---

# CarbonTrack AI Agent Instructions

This document provides essential guidance for AI agents working on the CarbonTrack codebase.

## Architecture Overview

The project is a monorepo with two main parts:
1.  **`backend/`**: A PHP-based REST API built with the Slim micro-framework.
2.  **`frontend/`**: A React single-page application (SPA) built with Vite.

Communication between the frontend and backend is via a RESTful API, which is documented in `backend/openapi.json`.

### Key Files
- `backend/openapi.json`: The OpenAPI specification that defines the contract between the frontend and backend. Keeping this up-to-date is crucial.
- `backend/src/routes.php`: Defines all API endpoints and maps them to controller actions.
- `frontend/src/router/`: Defines the client-side routes.
- `frontend/src/pages/admin/AiWorkspace.jsx`: Dedicated admin AI workspace. Keep its UX, starter prompts, and capability presentation aligned with the backend admin AI catalogue and routes.
- `backend/database/localhost.sql`: Contains the primary database schema. All migration scripts in `backend/database/migrations/` have been executed, so this file, along with the migration scripts, represents the definitive schema.
- `backend/config/admin_ai_commands.json`: Source of truth for the admin AI assistant's single multi-turn command and tool catalogue. Whenever you add, rename, or remove admin functionality that the AI should understand, update this file (and keep the companion loader `admin_ai_commands.php` in sync) so the knowledge base matches the code.

## Backend (PHP / Slim)

The backend is a lean API service. Avoid adding redundant database structure checking logic that could impact performance.

### Core Concepts
- **Dependency Injection**: Services are managed by a PHP-DI container configured in `backend/src/dependencies.php`. When adding new services, register them here.
- **Routing**: Routes are defined in `backend/src/routes.php`. Each route is mapped to a method in a controller class located in `backend/src/Controllers/`.
- **ORM**: The project uses Laravel's Eloquent ORM. Models are defined in `backend/src/Models/`. Database interactions should use these models.
- **Middleware**: Cross-cutting concerns like authentication, logging, and CORS are handled by middleware found in `backend/src/Middleware/`. See `AuthMiddleware.php` for the JWT-based authentication flow.
- **Validation**: Input validation is handled using `respect/validation`.

### Developer Workflow
- **Setup**: Run `composer install` in the `backend` directory.
- **Run Server**: `composer start` (runs `php -S localhost:8080 -t public`).
- **Run Tests**: `composer test` (runs `phpunit`). Tests are located in `backend/tests/`.
- **Debugging API**: To bypass Cloudflare firewall protection when debugging backend APIs, add the `x-debug-token` header with value `9c0d4f1a-5a0b-4b2c-9c7e-a1e2f3d4b5c6` to your requests.
- **Logging & Audit Baseline (Mandatory)**: Any backend feature you add or modify must be wired into the project’s custom observability stack so operations can troubleshoot and auditors can trace behavior.
    - **System logs**: HTTP endpoints must remain covered by the global `RequestLoggingMiddleware` + `SystemLogService`. Non-HTTP execution paths (jobs, CLI flows, async tasks) must add an equivalent explicit system-event record or documented fallback.
    - **Audit logs**: Business actions, admin operations, user-triggered mutations, sensitive reads, exports, AI operations, and batch/system actions must record structured entries through `AuditLogService`.
    - **Error handling**: Expected and unexpected failures must use explicit error handling and persist exceptions/errors through `ErrorLogService`; do not rely only on plain `error_log()` or a generic PSR logger.
    - **DI requirement**: When a controller/service/job needs audit or error logging, register the required dependencies in `backend/src/dependencies.php`; do not leave logging as an optional afterthought.
    - **Review rule**: If you touch an endpoint or business flow and it still lacks the custom logging trio above, treat that as incomplete work and fix it before finishing.
- **After Backend Changes (Required)**: Whenever you modify controllers, routes, models, requests, or responses:
    - Update `backend/openapi.json` to reflect the new or changed endpoints, request/response schemas, status codes, and auth requirements.
    - Add or update PHPUnit tests covering the changed behavior in `backend/tests/` (Unit and/or Integration). Focus on happy paths, validation errors, edge cases, and auth. Run it in the Powershell terminal to see output.
    - Ensure all tests pass before committing.
    - Use `backend/database/localhost.sql` as the authoritative schema reference when adjusting models and API contracts.
    - Keep the AI knowledge base current: if the change affects admin automation, navigation, agent tools, confirmation flows, conversation fields, audit action names, or AI-assisted admin routes, update `backend/config/admin_ai_commands.json` (and any related metadata files) so the admin AI stays accurate.
    - For admin AI changes, treat the following as a single maintenance set: `backend/config/admin_ai_commands.json`, `backend/openapi.json`, backend tests, frontend admin AI entry text/behavior, and conversation audit responses.
    - Optionally run the OpenAPI compliance checks in `backend/check_openapi_compliance.php` or `backend/enhanced_openapi_check.php` to verify consistency.

## Frontend (React / Vite)

The frontend is a modern SPA.

### Core Concepts
- **UI Components**: The UI is built with **shadcn/ui** on top of Radix UI and Tailwind CSS. Find components in `frontend/src/components/`.
- **State Management**:
    - **Server State**: Use **TanStack Query (React Query)** for all interactions with the backend API. This handles caching, refetching, and loading/error states.
    - **Client State**: Use **Zustand** for global client-side state that isn't fetched from the server.
- **Routing**: `react-router-dom` is used for client-side routing. Page components are in `frontend/src/pages/`.
- **Data Fetching**: Use the pre-configured `axios` instance for API requests, integrated with TanStack Query.
- **Forms**: Use **React Hook Form** with **Zod** for schema-based validation.

### Developer Workflow
- **Setup**: Run `pnpm install` in the `frontend` directory.
- **Build**: `pnpm build`.
- **Lint**: `pnpm lint`.
- **After Frontend Changes (Required)**: After modifying components, hooks, routes, state, or build config:
    - Run `pnpm lint` and ensure it passes before committing. Treat passing ESLint as a required quality gate alongside backend `composer test`.
    - Run `pnpm build` to validate syntax, type-checking, and bundling issues before committing.
    - Do NOT execute `pnpm dev` within this AI session if terminal output cannot be captured; rely on local/CI builds instead, and keep code lint/type-clean.
    - If new admin UI flows, functions, labels, or session-audit displays are introduced, update any corresponding AI knowledge base entries (e.g., adjust keywords, routes, tools, and confirmation metadata in `backend/config/admin_ai_commands.json`) so the admin AI surfaces them correctly.

## Admin AI Maintenance

- The admin AI is a single multi-turn assistant entry. Do not introduce or document a separate long-lived `intent` product flow as the primary path.
- The primary admin AI UX lives in the dedicated `/admin/ai` workspace. If you change workspace navigation, starter prompts, quick actions, or bootstrap payloads, update the backend catalogue, OpenAPI contract, and frontend workspace together.
- Keep task-template prompts and action labels in `/admin/ai` operational and locale-aware. Prefer direct admin phrasing that reliably maps to backend `managementActions`, especially for Chinese prompts used by administrators in production.
- Conversation history is reconstructed from logs. If you change admin AI message/audit semantics, keep `llm_logs`, `audit_logs`, and any conversation aggregation responses compatible.
- If the agent adds or changes keyword fallback routing, synonym matching, or “continue from result” affordances, update `backend/config/admin_ai_commands.json` keywords alongside the workspace UI so natural-language prompts and one-click follow-up actions stay aligned.
- Any change to admin AI tools, keywords, navigation targets, confirmation behavior, session audit structure, or route contracts must update both root agent docs (`AGENTS.md`, `GEMINI.md`).

## Git Commit Guidelines

- **Language Style**: All git commit messages MUST be written in **Classical Chinese (Simplified forms)** (简体中文文言文).
    - Ensure the tone is concise and adheres to classical grammatical structures where appropriate, but remains understandable. You can refer to previous Chinese commits.
    - **Examples**:
        - Feature: `初创此项，以此为基` (Initial commit / Add feature)
        - Defect: `修复漏洞，不仅其微` (Fix bug)
        - Refactor: `重构代码，去芜存菁` (Refactor code)
        - Docs: `修订文档，文以载道` (Update documentation)
    - **Format**: Use the conventional `<type>(<scope>): <文言文主题>` pattern as in `fix(admin): 修复管理布局引用，兼修规约`; keep scope concise (e.g., `frontend`, `backend`, `ci`, `i18n`, `admin`, etc.).
