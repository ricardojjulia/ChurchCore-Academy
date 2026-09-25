# End-to-End Suite

The e2e suite runs the real application — a **production build** — against a **disposable
Supabase stack** built from `supabase/migrations`, in a real browser, as every role. It runs on
every pull request (`.github/workflows/e2e.yml`) and is a required check for `main`.

`npm test` (unit tests with mock databases) cannot catch what this suite exists for: schema
drift in real SQL, role-allowlist mistakes, production-only behavior (stripped error messages,
route prefetch caching), proxy/routing rules, and pages that crash for some roles. The first run
of this suite found all of those (#167, #168 and the issues in `e2e/surfaces/known-issues.ts`).

## Running it

```bash
npm run test:full                       # everything
npm run test:full -- e2e/journeys       # just the journeys (any Playwright args pass through)
npm run test:full -- --skip-build ...   # reuse the last build in .next-e2e
npm run test:full -- --reset-db ...     # reapply every migration from scratch first
```

Requirements: Docker running, the Supabase CLI, and `npx playwright install chromium` once.
`test:full` never touches your local dev database: it runs its own stack (project id
`ChurchCore_Academy_e2e`, ports 574xx) and builds into `.next-e2e`, serving on port 3300.
Reports: `e2e/report/index.html`; failure traces: `test-results/`.

## What it checks

| Layer | Where | What |
|---|---|---|
| Coverage gate | `src/modules/acceptance/__tests__/surface-manifest.test.ts` (runs in `npm test`) | Every `page.tsx` and every exported API method is registered in `e2e/surfaces/manifest.ts`. |
| Page sweep | `e2e/sweep/pages.spec.ts` | Every page, as every persona and signed out: allowed roles get the page; everyone else is denied, redirected to their own portal, or sent to login; **nobody** gets an error screen. |
| API sweep | `e2e/sweep/api.spec.ts` | Every API method rejects unauthenticated calls; every GET is checked for every persona; mutations are checked against the student and guardian; **no** 5xx anywhere. |
| Journeys | `e2e/journeys/*.spec.ts` | Real workflows through the UI, with data created along the way (admissions portal, core academic loop, grading to transcript, student and guardian portals). |
| Focused specs | `e2e/*.spec.ts` | Regression specs for specific past bugs. |

Personas (one real login for every role, plus an admin in a second tenant for isolation
checks) are defined in `e2e/personas.ts` and seeded by `scripts/e2e/seed.ts`.

## Shipping a feature with its tests (required)

Every PR that adds or changes a user-facing surface ships its test surface in the same PR:

1. **New page or API method → manifest entry.** `npm test` fails until it's registered in
   `e2e/surfaces/manifest.ts` with its access list. Dynamic segments need a sample in
   `e2e/surfaces/samples.ts` (seed a fixture in `scripts/e2e/seed.ts` if nothing suitable exists).
2. **New workflow → journey spec** in `e2e/journeys/`, driving the UI the way a user would,
   creating its own data, including at least one denied-role or cross-tenant check.
3. **New role or institution type → persona** in `e2e/personas.ts` (the seed creates it).
4. Run `npm run test:full` locally for anything touching auth, routing, or a new surface.

To draft manifest entries from evidence instead of guessing:

```bash
E2E_PROBE=1 npm run test:full -- e2e/tools/probe.spec.ts   # observe every surface as every persona
node --import tsx scripts/e2e/generate-manifest.ts         # print drafts for unregistered surfaces
```

A draft records what the app *does*. Review it against the code before pasting — if a persona
gets an error screen or a 5xx, that's a bug to fix (or file), not an expectation.

## Known issues

`e2e/surfaces/known-issues.ts` lists bugs the sweeps currently observe, each with a GitHub
issue. The sweep treats a listed failure as expected, and **fails when it stops happening** —
remove the entry in the PR that fixes the bug. Don't add entries to get a red build green
without filing an issue.

## Operational notes

- Sweeps block Next.js `<Link>` prefetches (`blockPrefetch`). A production admin page prefetches
  16–22 routes, each passing through the proxy's Supabase `getUser()` call; at sweep volume that
  exhausts the local auth container's connections and shows up as spurious 401s. Journeys keep
  real prefetching.
- Keep Playwright workers low (CI uses 2) for the same reason. API checks also retry a
  signed-in 401 or a 5xx a few times with backoff (`e2e/surfaces/request.ts`): local auth
  strain is transient, a real bug reproduces every time.
- The app server's output goes to `.e2e-runtime/server.log` (uploaded by CI on failure). The
  runner supervises it: if it dies mid-run it's restarted and the run fails with an explicit
  message, so a dead server never shows up as a wall of "connection refused" failures.
- `test:full` refuses to start if something already listens on the e2e port (3300 by default,
  `E2E_PORT` to change): otherwise the suite would silently test that other process.
- The seed refuses to run against anything but the local e2e database.

## Adopting after a large change

`E2E_RECORD_VIOLATIONS=1 npm run test:full -- e2e/sweep` records every sweep violation to
`e2e/.auth/violations/` instead of failing; `node --import tsx scripts/e2e/draft-known-issues.ts`
turns them into `known-issues.ts` entries using its issue-mapping rules and lists anything
unmapped. Unmapped violations need a fix or a new GitHub issue — never a catch-all rule.
