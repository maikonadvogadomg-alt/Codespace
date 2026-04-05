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
- Upload ZIP files, import from GitHub, or import directly from Replit to create projects
- Browse file trees, view/edit files with syntax highlighting
- AI chat with Gemini cortesia (free, no key needed) + 4 configurable profiles (user provides own API keys)
- Web content reading: paste any URL in chat and AI reads the page content automatically
- AI can modify, create, and delete project files via action tags
- AI renders rich markdown: images, SVG diagrams, tables, code blocks, links, formatting
- AI system prompt includes SVG diagram generation instructions for visual explanations
- **Agent Mode**: toggle in AI panel header — when ON, AI auto-executes `<codelens-exec>` commands and auto-applies `<codelens-write>` file changes, then feeds results back to AI for iterative autonomous work
- VS Code-like terminal (SSE streaming, auto-detects server ports)
- Live preview panel (static preview + dev server proxy)
- GitHub push/pull (create repo, push changes, commit & push button)
- Git Commit modal: after linking to GitHub, user can commit & push with custom message via toolbar button
- Plugin/library browser in sidebar
- Settings page for AI profiles and GitHub token
- PWA-ready

### Assistente Jurídico (AplicativoMaikon) — `/app`
Standalone legal assistant app running on port 5000. Express + Vite + React. Uses npm (not pnpm). BASE_PATH=/app.

#### PDPJ Integration (In Progress)
- **Owner**: Maikon da Rocha Caldeira, CPF 094.941.286-48, OAB 183.712/MG
- **PEM Key**: Configured as env var `PDPJ_PEM_PRIVATE_KEY` (RSA private key from ICP-Brasil)
- **Auth Flow**: JWT signed with PEM (RS256) → exchange at Keycloak SSO for access_token → call Gateway APIs
- **SSO Production**: `https://sso.cloud.pje.jus.br/auth/realms/pje/protocol/openid-connect/token`
- **Gateway Production**: `https://gateway.cloud.pje.jus.br/`
- **Gateway Homologação**: `https://gateway.stg.cloud.pje.jus.br/`
- **Domicílio Prod**: `https://domicilio-eletronico.pdpj.jus.br`
- **Domicílio STG**: `https://gateway.stg.cloud.pje.jus.br/domicilio-eletronico-hml`
- **Status**: BLOCKED — waiting for CNJ to register public key and provide client_id. Email template ready at `arquivos diversos/attached_assets/email_para_pdpj_1771903064820.txt` (project 36). Must be sent to integracaopdpj@cnj.jus.br with maikon.pub.pem attached.
- **Correct auth flow** (from jwt-tools/pjud_token.txt): `grant_type=client_credentials` + `client_assertion_type=jwt-bearer` + `client_assertion=(JWT signed with PEM)` → does NOT require MFA
- **Current code issue**: routes.ts `generatePdpjToken()` uses JWT directly as Bearer token instead of exchanging at Keycloak first
- **DataJud** (public API): Already works for basic process consultation
- **CNJ Comunicações (PCP)**: INTEGRATED — endpoint `/api/cnj/comunicacoes` queries real communications by OAB, party name, process number, date range. Uses homologação URL `hcomunicaapi.cnj.jus.br` (production URL `comunicaapi.pje.jus.br` blocks international access via CloudFront geo-restriction). Frontend page at `/comunicacoes`. Certidão PDF download via `/api/cnj/comunicacoes/certidao/:hash`.
- **Swagger APIs available**: Notifications service (events, subscriptions, templates, tribunals) — file `MAIKONMG1_12-Maikon_1209-183712-oas3-swagger.json`

#### Old Project (ReplitExport project 36 in CodeSpace)
- **jwt-tools/**: Created by VS Code Copilot — sign.js, gen_pjud.js, gerar_token.mjs (correct JWT generation scripts)
- **arquivos diversos/**: PEM keys, ORIGINAL Swagger files from PDPJ/CNJ (not examples), email draft for PDPJ, plus some Perplexity examples about RS256/JWT
- **AIEventsSF-1/**: Mastra agents with PDPJ tools (pdpjConsultaTool.ts, pdpjComunicacaoTool.ts, pdpjPeticaoTool.ts)
- **FalarNoOutroLink/**: Full legal app (PJE, E-Proc, INSS, Intimações pages)
- **apoia-master/**: APOIA system (runs inside PJud) — has jwt.ts, swagger.json reference implementations

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
