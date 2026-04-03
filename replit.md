# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Routing**: Wouter (client-side)
- **File handling**: multer (upload), adm-zip (ZIP extraction)
- **GitHub integration**: @octokit/rest

## Artifacts

### Code Editor (CodeLens) — `/`
Personal code editor and analysis tool. Features:
- Upload ZIP files to extract and browse project file trees
- Click files to view content in a syntax-aware editor
- AI analysis of individual files and folders (uses your own API key)
- GitHub integration to push project as a new repository
- Settings page to configure AI API key, base URL, model, and GitHub token

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

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
