# Phase 2 Next.js Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vercel-ready React/Next.js version of Buboo while preserving the verified Phase 1 domain and Supabase behavior.

**Architecture:** Scaffold a new Next.js App Router project in `_codex_workspaces/buboo-next`. Copy the proven domain/store code into `src` without import-path churn, expose it through route handlers, then build mobile participant and dense admin React screens against those APIs.

**Tech Stack:** Next.js App Router, React, Node.js ESM, `node:test`, Drizzle ORM, `pg`, Supabase PostgreSQL.

---

### Task 1: Scaffold Project

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `next.config.js`
- Create: `jsconfig.json`
- Create: `app/layout.jsx`
- Create: `app/page.jsx`
- Create: `app/globals.css`

- [ ] Create the minimal Next.js project files manually.
- [ ] Add scripts: `dev`, `build`, `start`, `test`, `db:check`, `db:setup`, `db:migrate`.
- [ ] Install dependencies: `next`, `react`, `react-dom`, `drizzle-orm`, `pg`.

### Task 2: Carry Over Domain and DB Code

**Files:**
- Create/modify: `src/**`
- Create/modify: `tests/domain/**`
- Create/modify: `scripts/**`

- [ ] Copy `src/appLogic.js`, `src/domain`, `src/db`, `src/config`, `src/store.js`, `src/seedData.js`, `src/demoData.js`, and migration scripts into the Next workspace.
- [ ] Keep test imports unchanged by preserving the Phase 1 `src/` module layout.
- [ ] Run a domain test and confirm it passes.
- [ ] Run the full test suite and confirm carried-over logic still passes.

### Task 3: Add Next API Routes

**Files:**
- Create: `src/lib/http/apiResponse.js`
- Create: `src/lib/http/adminAuth.js`
- Create: `app/api/**/route.js`
- Test: `tests/routes/nextRoutes.test.js`

- [ ] Write route-surface tests for all participant, admin, and keepalive endpoints.
- [ ] Implement JSON response helpers and domain error translation.
- [ ] Implement signed admin cookie helpers.
- [ ] Implement participant APIs: public event, submission, result, contact.
- [ ] Implement admin APIs: login, events create, dashboard, settings, calculate, release, member update.
- [ ] Implement cron-only keepalive route.

### Task 4: Build React Participant UI

**Files:**
- Create: `app/e/[slug]/page.jsx`
- Create: `src/components/event/EventClient.jsx`
- Create: `src/components/ui/fields.jsx`
- Test: `tests/ui/nextPages.test.js`

- [ ] Write page existence tests.
- [ ] Implement mobile-first vote form.
- [ ] Implement result lookup.
- [ ] Implement matched/no-match/expired/pending result rendering.
- [ ] Implement contact reveal button for matched users.

### Task 5: Build React Admin UI

**Files:**
- Create: `app/buboo-ops-local/login/page.jsx`
- Create: `app/buboo-ops-local/page.jsx`
- Create: `src/components/admin/AdminLoginClient.jsx`
- Create: `src/components/admin/AdminDashboardClient.jsx`
- Test: `tests/ui/nextPages.test.js`

- [ ] Implement admin login.
- [ ] Implement event settings and new event creation.
- [ ] Implement calculate/release actions.
- [ ] Implement participants/submission versions table.
- [ ] Implement matches, ranking, contact logs, member search/edit table.

### Task 6: Style and Verify

**Files:**
- Modify: `app/globals.css`
- Create: `vercel.json`
- Create: `docs/deployment/2026-05-24-phase-2-nextjs-result.md`

- [ ] Apply operational, mobile-safe CSS.
- [ ] Add Vercel cron config.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run local Next dev server and smoke participant/admin/keepalive.
- [ ] Document results and any remaining Phase 3 deployment steps.
