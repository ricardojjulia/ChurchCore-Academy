# End-to-End Browser Verification Runbook

Date: 2026-09-14

## Purpose

`npm test` (mock-DB unit tests) has a proven blind spot: it never exercises a real Postgres
connection, a real Supabase session, or a real browser render, so it cannot catch schema-shape
mismatches, role-allowlist drift, or client-side crashes that only appear once real data flows
through the real stack. This runbook exists to make that gap closeable on demand — it is not
part of `npm test` and is not a required CI check, the same way `verify:*` database rehearsal
scripts aren't.

## Required Environment

- Local Supabase running with `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_*` set (see
  `memory/project_local_db_setup.md` for the standard local setup and demo credentials).
- The dev server running locally on port 3200 (`npm run dev`).
- Chromium installed for Playwright: `npx playwright install chromium --with-deps`.
- The demo/test personas referenced in `e2e/helpers.ts` (`PERSONAS`) must exist in the local
  database with the shared demo password. Some personas (`academicAdmin`, `advisor`,
  `formationReviewer`) are not part of the standard seed and must be created manually — see
  `memory/project_local_db_setup.md` for the exact rows required (`auth.users`,
  `academy_people`, `academy_person_role_assignments`, `academy_account_links`).

## Running the Suite

```bash
npm run dev &            # or run in a separate terminal
npx playwright install chromium --with-deps   # first run only
npm run test:e2e
```

Playwright reports failures with a screenshot, trace, and DOM snapshot under `test-results/`
(gitignored) — inspect those before assuming a failure is a real regression vs. a stale
selector.

## What This Suite Is (and Isn't)

- It is a manually-run, local verification tool for real-browser regressions across every
  Academy role — not a CI gate. Standing up local Supabase plus seeded demo personas inside
  GitHub Actions is out of scope for now; this runbook documents the manual path instead.
- Test data it creates (e.g. a logged practicum session, an advisor assignment) is real,
  persisted local data. Clean up test-created rows between runs if they'd otherwise skew what
  a human tester sees in the local demo environment.
