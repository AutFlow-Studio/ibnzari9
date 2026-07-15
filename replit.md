# AutFlow Studio

An agency owner operating system — manage clients, projects, payments, documents, meetings, tasks, calendar, notifications, and reports in one place.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/autflow-studio run dev` — run the frontend (port 22583)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run migrate` — run full migration (creates all tables + default admin user)
- `pnpm --filter @workspace/scripts run seed` — seed demo data

## Dev Login

- Email: `admin@autflow.io`
- Password: `admin123`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui (`artifacts/autflow-studio`)
- API: Express 5 (`artifacts/api-server`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Auth: Session-based (bcrypt + connect-pg-simple)
- Storage: GCS object storage (presigned URL flow)

## Where things live

- DB schema: `lib/db/src/schema/` — each domain has its own file
- API contract: `lib/api-spec/openapi.yaml` — source of truth
- Generated hooks: `lib/api-client-react/src/generated/`
- Generated Zod schemas: `lib/api-zod/src/generated/`
- API routes: `artifacts/api-server/src/routes/`
- Frontend pages: `artifacts/autflow-studio/src/pages/`

## DB Tables (13)

clients, projects, deliverables, payments, documents, meetings, notes, tasks, activity, users, sessions, agency_settings, notifications

## Architecture decisions

- Session-based auth (not JWT) — sessions stored in `sessions` table via connect-pg-simple
- `app.set("trust proxy", 1)` required for Replit's reverse proxy
- CORS: `origin: true` with `credentials: true` — same-origin in prod, Vite proxy in dev
- Document uploads: two-step presigned URL flow — browser PUTs directly to GCS
- Notifications: fire-and-forget via `createNotification()` helper

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any `lib/*` change, run `pnpm run typecheck:libs` before leaf artifact checks
- `lib/api-client-react/src/index.ts` must NOT have duplicate export lines
- Fresh env setup: `pnpm install` → `pnpm --filter @workspace/scripts run migrate` → `pnpm --filter @workspace/scripts run seed`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
