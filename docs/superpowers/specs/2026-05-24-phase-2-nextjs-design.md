# Phase 2 Next.js Design

Date: 2026-05-24 KST
Workspace: `_codex_workspaces/buboo-next`

## Goal

Move the verified Buboo MVP into a Vercel-friendly React/Next.js application without changing the matching, ranking, identity, member-status, result-expiry, or Supabase storage rules that passed Phase 1.

## Approved Scope

The user approved Phase 2 execution after Phase 1 completed. Phase 2 covers:

- React participant voting/result pages
- React admin login/dashboard page
- Next.js API routes replacing the local Node HTTP server
- Reuse of the existing domain logic and Postgres store adapter
- Vercel cron keepalive path for Supabase Free pause mitigation
- Local verification through tests, build, and smoke checks

Phase 2 does not deploy to Vercel. GitHub/Vercel deployment stays Phase 3.

## Architecture

The new app uses Next.js App Router. UI lives in `app/` and `src/components/`. API route handlers live in `app/api/**/route.js` and call the preserved domain functions from `src/appLogic.js`.

The existing Phase 1 domain code is copied into `src/` without changing import paths, so the verified tests can run unchanged. The default storage mode remains JSON for local tests. Production and Vercel use `BUBOO_STORE=postgres` with `DATABASE_URL`.

Admin auth uses the same password + signed HTTP-only cookie concept as Phase 0/1. The fixed local route is `/buboo-ops-local`; `/admin` is intentionally not implemented.

## User Flows

Participant:

1. Opens `/e/<slug>`.
2. Selects gender and own seat number.
3. Enters name, phone, nickname.
4. Selects first and second preferred opposite-gender seats, including "없음".
5. Submits vote.
6. Later enters name and phone to view released result.
7. If matched, can reveal only the matched counterparty phone.

Admin:

1. Opens `/buboo-ops-local/login`.
2. Logs in with admin password.
3. Opens `/buboo-ops-local?event=demo` or another event slug.
4. Creates events, saves settings, calculates, releases, searches members, edits member profiles/status/memo.
5. Uses the participant URL `/e/<slug>` for the event.

## UI Direction

This is an operational tool, not a landing page. The admin UI should be dense, scan-friendly, and work-focused. The participant UI should be mobile-first, clear, and minimal, because people will use it on phones immediately after an offline event.

The UI uses plain CSS modules/global CSS first. shadcn/ui is intentionally deferred to avoid unnecessary dependency setup during this migration. Buttons, selects, inputs, tables, compact metric strips, and status pills are enough for MVP.

## Data and Error Handling

All API responses use JSON. Domain errors still return `{ error: reason }`, and client screens map common reason keys to Korean messages. Unknown errors render a generic Korean fallback.

The result and contact APIs keep the existing event-day expiry rule. The keepalive API requires `Authorization: Bearer <CRON_SECRET>` and does not print or return secrets.

## Testing

The Phase 1 domain tests are carried over and adjusted to import from `src/lib`. Additional tests verify:

- Next route files exist for the required API surface.
- React pages exist for participant, admin login, and admin dashboard.
- Admin hidden path stays `/buboo-ops-local` and `/admin` is absent.
- Vercel cron config points to `/api/internal/keepalive`.

Verification commands:

```powershell
npm test
npm run build
```

Local smoke after build:

```powershell
$env:BUBOO_STORE='postgres'
$env:PORT='60660'
npm run dev
```

Then check participant page, admin login/dashboard, and keepalive.
