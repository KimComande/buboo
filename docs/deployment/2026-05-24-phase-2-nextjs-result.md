# Phase 2 Next.js Result

Date: 2026-05-24 KST
Workspace: `_codex_workspaces/buboo-next`

## Scope

Phase 2 converted the Buboo MVP from the local Node/static-page shape into a Vercel-ready Next.js App Router project with React screens and API route handlers.

This phase does not deploy to Vercel. GitHub/Vercel deployment remains Phase 3.

## Implemented

- Next.js App Router project scaffold
- React participant page:
  - `/e/[slug]`
  - vote submission
  - result lookup
  - pending / expired / no-match / matched states
  - contact reveal for matched users
- React admin pages:
  - `/buboo-ops-local/login`
  - `/buboo-ops-local?event=<slug>`
  - hidden admin surface; `/admin` is absent
  - event settings
  - new event creation
  - 마감 및 계산
  - 결과 공개
  - participants/submission versions
  - matches, ranking, contact logs
  - member search/edit with 일반 / 저품질 / 블랙리스트
- Next API routes:
  - `GET /api/events/[slug]/public`
  - `POST /api/events/[slug]/submissions`
  - `POST /api/events/[slug]/result`
  - `POST /api/events/[slug]/contact`
  - `POST /api/admin/login`
  - `POST /api/admin/events`
  - `GET /api/admin/events/[slug]/dashboard`
  - `POST /api/admin/events/[slug]/settings`
  - `POST /api/admin/events/[slug]/calculate`
  - `POST /api/admin/events/[slug]/release`
  - `POST /api/admin/members/[memberId]`
  - `GET /api/internal/keepalive`
- Supabase/Postgres storage adapter carried over from Phase 1
- Domain tests carried over without changing the verified business logic imports
- Vercel cron config:
  - `/api/internal/keepalive`
  - `0 18 * * *`

## Verification

Commands run in the main W: workspace:

```powershell
npm test
```

Result:

- 58/58 passed

`npm run build` in the W: workspace fails because Next 16 attempts filesystem operations that are not supported correctly on this W:/OneDrive path. The failure happens before application code is the issue and includes readlink/junction errors.

To verify the actual app build, the same workspace was copied to:

```text
C:\Users\WIN_AL03197975\.codex\memories\buboo-next-build-20260524
```

Commands run in the C: temporary build copy:

```powershell
npm install --prefer-offline --no-audit --no-fund
npm test
npm run build
```

Results:

- `npm test`: 58/58 passed
- `npm run build`: passed
- Next route output included all participant, admin, and keepalive API routes.

## Postgres Mode Smoke

Temporary dev server:

```text
http://127.0.0.1:60661
```

Environment:

- `BUBOO_STORE=postgres`
- `ADMIN_PATH=/buboo-ops-local`
- `ADMIN_PASSWORD=local-admin`
- `CRON_SECRET=local-cron-secret`
- `.env.local` copied only inside Codex/temporary workspaces

Smoke results:

| Check | Result |
|---|---|
| `GET /api/events/demo/public` | OK |
| `GET /e/demo` | 200 |
| `POST /api/admin/login` | OK |
| `GET /buboo-ops-local?event=demo` | 200 |
| `GET /api/admin/events/demo/dashboard` | 143 members / 10 participants |
| `GET /api/internal/keepalive` | OK, postgres |

The temporary dev server was stopped after smoke verification.

## Operational Notes

- For local development inside the W:/OneDrive workspace, `dev` and `build` scripts use webpack mode to avoid Turbopack junction failures.
- If W:/OneDrive still produces a local build filesystem error, use the C: temporary copy technique for build verification.
- Vercel should build on Linux, so the W:/OneDrive-specific readlink/junction problem should not apply there.

## Remaining Phase 3

- Create GitHub repository.
- Push `_codex_workspaces/buboo-next`.
- Add Vercel project.
- Set Vercel environment variables:
  - `DATABASE_URL`
  - `BUBOO_STORE=postgres`
  - `ADMIN_PATH=/buboo-ops-local`
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_SECRET`
  - `CRON_SECRET`
  - `COOKIE_SECURE=true`
- Deploy and run the same smoke checks on the Vercel URL.
