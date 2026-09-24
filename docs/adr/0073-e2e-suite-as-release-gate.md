# ADR 0073: End-to-End Suite As A Release Gate, With A Mandatory Surface Manifest

Date: 2026-09-24
Status: accepted

## Context

Until now, verification was `npm test` (unit tests with mock databases), `lint`, and `build`,
plus three Playwright specs run by hand against a developer's local database. The first run of
an automated suite against a **production build** on a **fresh database built from migrations**
found, in a codebase whose unit tests all passed:

- the public applicant portal, the Vercel cron jobs (including the every-minute email worker),
  and the Stripe webhook were redirected to the login page by the proxy (#168);
- public application submission failed on two schema mismatches once reachable (#168);
- any signed-in user, including a student, could create academic years and periods, delete
  courses, and read the full student roster (#178);
- production-only failures: sign-in bounced back to the login page, and every access denial
  showed a crash screen (#167);
- a dozen pages and APIs that crash for some or all roles (#169–#181).

None of these can be caught by mock-database unit tests or a development server.

## Decision

1. **`npm run test:full`** provisions a disposable Supabase stack (own project id and ports),
   applies every migration, seeds a login for every role plus a second tenant
   (`scripts/e2e/seed.ts`), builds and serves the production bundle, and runs Playwright.
2. **It runs on every pull request** (`.github/workflows/e2e.yml`) and is a required status
   check for `main`.
3. **Every page and API method must be registered** in `e2e/surfaces/manifest.ts` with its
   access list. A unit test in `npm test` fails when a surface is missing, stale, or lacks
   samples. The page and API sweeps check every registered surface for every persona: allowed
   roles get through, everyone else is denied, nobody gets an error screen or a 5xx.
4. **New workflows ship a journey spec** in `e2e/journeys/`; new roles ship a persona. The
   feature factory (`.claude/skills/feature-factory`), `test-verifier`, and
   `implementation-validator` enforce this; the PR template asks for it.
5. **Current bugs are pinned, not hidden.** `e2e/surfaces/known-issues.ts` lists each observed
   failure with its GitHub issue; the sweep fails when a pinned failure stops happening, so the
   entry is removed with the fix.

## Consequences

- Each PR takes roughly 15–20 more minutes in CI (the sweep checks ~330 surfaces × 17
  identities). Workers stay low because the local Supabase auth container is the bottleneck;
  moving the proxy to local JWT verification (#177) would cut that substantially.
- Adding a page or API method now requires a manifest entry in the same PR. The probe tool
  (`e2e/tools/probe.spec.ts`) and `scripts/e2e/generate-manifest.ts` draft entries from
  evidence.
- Access lists encode intended behavior; where the app deviates, a GitHub issue must exist.
- The suite depends on Docker and the Supabase CLI in CI.

## Alternatives considered

- **Nightly-only runs.** Rejected by the product owner: regressions would merge and be found up
  to a day later.
- **Process-only enforcement (checklists).** Rejected: the manual runbook existed and the three
  specs still went stale; the coverage gate makes omissions fail CI.
