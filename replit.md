# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
All UI is in **Portuguese (pt-BR)**. User is on mobile.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Routing**: Wouter (client-side SPA)
- **File handling**: multer (upload), adm-zip (ZIP extraction)
- **GitHub integration**: @octokit/rest

## Artifacts

### Code Editor (CodeLens) — `/`
Personal code editor like SPCK Editor. Features:
- Upload ZIP files or import from GitHub to create projects
- Browse file trees, view/edit files with syntax highlighting
- AI chat with 4 configurable profiles (user provides own API keys)
- AI can modify, create, and delete project files via action tags
- VS Code-like terminal (SSE streaming, auto-detects server ports)
- Live preview panel (static preview + dev server proxy)
- GitHub push/pull (create repo, push changes)
- Plugin/library browser in sidebar
- Settings page for AI profiles and GitHub token
- PWA-ready

### API Server — `/api`
Express 5 backend serving all app routes.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Tables

- `settings` — stores AI API key, base URL, model, GitHub token (single row)
- `projects` — stores uploaded project metadata (slug, name, file count, storage path)

## File Storage

Uploaded ZIP files are extracted to `$STORAGE_PATH` (defaults to OS temp directory / `code-editor-projects/`).
Each project has its own subdirectory identified by a UUID slug.
Files are also persisted to PostgreSQL for durability across server restarts.

## Proxy Architecture

The dev-server proxy (`dev-server.ts`) forwards requests from the CodeLens iframe to running user project dev servers.
Key detail: Express JSON middleware consumes the request body stream before proxying, so the `proxyRequest()` helper re-serializes the parsed body (JSON or urlencoded) into a Buffer for forwarding. This is centralized in a single helper used by all proxy routes.

## Deployment

- Production build: `pnpm --filter @workspace/code-editor run build` (output: `artifacts/code-editor/dist/public/`)
- Production build: `pnpm --filter @workspace/api-server run build` (output: `artifacts/api-server/dist/index.mjs`)
- SPA fallback: configured in `artifact.toml` with `/* → /index.html` rewrite rule
- Vite config: PORT/BASE_PATH env vars are optional during build (defaults to 22595 and `/`)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
