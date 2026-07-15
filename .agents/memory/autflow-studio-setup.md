---
name: AutFlow Studio setup
description: Full-stack agency OS — key architecture decisions, known bugs fixed, and bootstrap steps worth remembering across sessions.
---

## Bootstrap sequence (fresh environment)

```
pnpm install
pnpm --filter @workspace/scripts run migrate   # creates all tables + admin user
pnpm --filter @workspace/scripts run seed      # populates demo data
```

Dev login: `admin@autflow.io` / `admin123`

## Object Storage

- Bucket provisioned via `setupObjectStorage()` — sets `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`, `DEFAULT_OBJECT_STORAGE_BUCKET_ID`
- **PRIVATE_OBJECT_DIR format**: `/<bucket-id>/.private` — used in `parseObjectPath()` in `objectStorage.ts`
- Sidecar runs at `http://127.0.0.1:1106` — returns `404` on `/health` (not a health endpoint), but `/object-storage/signed-object-url` works
- If storage env vars are not set, uploads fail with a 500 at `getPrivateObjectDir()` — the fix is to call `setupObjectStorage()` and restart the API server
- `normalizeObjectEntityPath` converts a GCS signed URL (`https://storage.googleapis.com/<bucket>/.private/uploads/<uuid>?sig=...`) to `/objects/uploads/<uuid>` for DB storage

## Document URL rules

- File-backed docs: `url` stored in DB as `/objects/uploads/<uuid>`
- Serve URL: `/api/storage/objects/uploads/<uuid>` (prepend `/api/storage` to the stored `url`)
- External links: stored and used as-is
- `isFileBacked(url)` → `url.startsWith("/objects/")`

## Production safety — destructive operations

**Reset endpoint** (`POST /api/admin/reset`) has THREE independent gates:
1. `ENABLE_RESET_ENDPOINT` env var must equal exactly `"true"` — returns 404 otherwise (endpoint invisible to scanners)
2. `requireOwner` middleware — user must have `role = "owner"`
3. Request body must contain `{ confirmationPhrase: "DELETE ALL DATA" }` — returns 422 otherwise

**NEVER set `ENABLE_RESET_ENDPOINT=true` in production deployments.** Only set it in dev/demo environments that need re-seeding.

**Frontend Reset Data button** is double-gated:
- `import.meta.env.VITE_ENABLE_RESET === "true"` (Vite build-time flag — absent by default)
- `user?.role === "owner"` (checked at render time from auth session)
- When shown, requires typing `"DELETE ALL DATA"` verbatim before confirm button enables

**Client delete cascade warning**: The AlertDialog explicitly lists all cascade-deleted data (projects, deliverables, payments, documents, meetings, tasks, notes) so users understand the full scope before confirming.

**Document delete**: Previously used `window.confirm` — now uses a proper AlertDialog with context-sensitive message (file upload vs link).

## Known bugs fixed

1. **`clients/detail.tsx` document links** (BUG): Fixed — file-backed docs now route through `/api/storage${objectPath}` instead of raw `doc.url`.
2. **Storage env vars not set** (ROOT CAUSE of all upload failures): Fixed by calling `setupObjectStorage()`.
3. **`window.confirm` in DocumentCard** (MEDIUM): Fixed — replaced with AlertDialog.
4. **No cascade warning on client delete** (HIGH): Fixed — AlertDialog now lists all data that will be destroyed.

## Architecture notes

- Auth: session-based (bcrypt + connect-pg-simple), sessions in `sessions` table. `app.set("trust proxy", 1)` required.
- CORS: `origin: true`, `credentials: true` — same-origin in prod, Vite proxy in dev
- All protected routes sit behind `requireAuth` middleware in `routes/index.ts`
- Storage routes are protected (auth required for upload URL and object download)
- Fire-and-forget GCS delete on document delete — logs errors (non-404) with `req.log.error`, does not surface to client
- `documents.ts` does NOT set ACL policies on upload — `downloadObject` uses ACL only for Cache-Control headers; auth at route level is the access control
- Express 5 wildcard params: `*path` syntax, `req.params.path` is a string (not array)

## CSS / Design

`index.css` CSS variables were originally set to `red` as placeholders in the source project. Real HSL values were applied during the import.

## lib/api-client-react

- `lib/api-client-react/src/index.ts` must NOT have duplicate export lines — codegen can add them twice
- `customFetch` in `custom-fetch.ts` does NOT need `credentials: "include"` — session cookies are sent automatically by the browser on same-origin; the Vite proxy handles dev
- `setBaseUrl()` is available for Expo/non-browser clients
- The generated `useResetDemoData` hook sends no body — call `fetch("/api/admin/reset", ...)` directly if you need to pass `confirmationPhrase`

## DB schema (13 tables)

clients, projects, deliverables, payments, documents, meetings, notes, tasks, activity, users, sessions, agency_settings, notifications

## pnpm workspace packages

- `@workspace/db` — Drizzle ORM, schema, pool
- `@workspace/api-zod` — generated Zod schemas from OpenAPI spec
- `@workspace/api-client-react` — generated React Query hooks
- `@workspace/scripts` — migrate.ts, seed.ts
- `@workspace/api-spec` — openapi.yaml + codegen
