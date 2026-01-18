---
trigger: always_on
---

# CarbonTrack AI Agent Instructions

This document provides essential guidance for AI agents working on the CarbonTrack codebase.

## Architecture Overview

The project is a monorepo with two main parts:
1.  **`backend/`**: A PHP-based REST API built with the Slim micro-framework.
2.  **`frontend/`**: A React single-page application (SPA) built with Vite.

Communication between the frontend and backend is via a RESTful API, which is documented in `openapi.json`.

### Key Files
- `openapi.json`: The OpenAPI specification that defines the contract between the frontend and backend. Keeping this up-to-date is crucial.
- `backend/src/routes.php`: Defines all API endpoints and maps them to controller actions.
- `frontend/src/router/`: Defines the client-side routes.
- `database/localhost.sql`: Contains the primary database schema. All migration scripts in `database/migrations/` have been executed, so this file, along with the migration scripts, represents the definitive schema.
- `backend/config/admin_ai_commands.json`: Source of truth for the admin AI assistant's command catalogue. Whenever you add, rename, or remove admin functionality that the AI should understand, update this file (and keep the companion loader `admin_ai_commands.php` in sync) so the knowledge base matches the code.

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
- **After Backend Changes (Required)**: Whenever you modify controllers, routes, models, requests, or responses:
    - Update `openapi.json` to reflect the new or changed endpoints, request/response schemas, status codes, and auth requirements.
    - Add or update PHPUnit tests covering the changed behavior in `backend/tests/` (Unit and/or Integration). Focus on happy paths, validation errors, edge cases, and auth. Run it in the Powershell terminal to see output.
    - Ensure all tests pass before committing.
    - Use `database/localhost.sql` as the authoritative schema reference when adjusting models and API contracts.
    - Keep the AI knowledge base current: if the change affects admin automation or navigation, update `backend/config/admin_ai_commands.json` (and any related metadata files) so the admin AI suggestions stay accurate.
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
    - Run `pnpm build` to validate syntax, type-checking, and bundling issues before committing.
    - Do NOT execute `pnpm dev` within this AI session if terminal output cannot be captured; rely on local/CI builds instead, and keep code lint/type-clean.
    - If new admin UI flows, functions or labels are introduced, update any corresponding AI knowledge base entries (e.g., adjust keywords and routes in `backend/config/admin_ai_commands.json`) so the command palette can surface them correctly.

## Git Commit Guidelines

- **Language Style**: All git commit messages MUST be written in **Classical Chinese (Simplified forms)** (简体中文文言文).
    - Ensure the tone is concise and adheres to classical grammatical structures where appropriate, but remains understandable.
    - **Examples**:
        - Feature: `初创此项，以此为基` (Initial commit / Add feature)
        - Defect: `修复漏洞，不仅其微` (Fix bug)
        - Refactor: `重构代码，去芜存菁` (Refactor code)
        - Docs: `修订文档，文以载道` (Update documentation)
