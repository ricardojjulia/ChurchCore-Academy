# ChurchCore Academy — Agent Reference

This file is the detailed guide for AI-assisted development in this repository.
`AGENTS.md` is the cross-agent operating contract; read both before meaningful work.
This file is loaded automatically by every Claude Code session and every factory agent.
Keep it under 300 lines. Move procedures to `.claude/skills/`. Move architecture to `docs/`.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack) with TypeScript strict mode
- **UI:** Tailwind CSS 4 + Radix UI primitives + Lucide icons, styled with the Nocturne dark design system (`src/styles/tokens.css`, `src/components/ui/*`). No Mantine — do not add it or assume it's present.
- **Auth:** Supabase SSR (`@supabase/ssr`) — session in `src/lib/supabase/server.ts`
- **DB:** Supabase/Postgres — direct pool via `src/lib/database.ts` for repository/migration paths
- **Testing:** Node.js built-in test runner (`node:test` + `node:assert/strict`)
- **Linting:** ESLint via `eslint.config.mjs`
- **Runtime:** Node.js 20+, deployed on Vercel

## Commands

```
npm run dev          # start local dev server
npm test             # run all tests (node --import tsx --test "src/**/*.test.ts")
npm run lint         # eslint
npm run build        # next build (TypeScript check + bundle)
npm run verify       # npm test && npm run lint && npm run build
npm run verify:governance # verify required SDLC/Council/PR-review docs are wired
npm run test:full    # e2e: disposable Supabase + production build + Playwright (docs/testing/e2e-suite.md)
```

## Project layout

```
src/app/             # Next.js App Router pages and API routes
src/components/      # React client components (UI only, no business logic)
src/lib/             # Shared infra (supabase client, database pool, utils)
src/modules/         # Domain modules — each owns its own types, validation, repository, tests
	academy-auth/      # Auth policy, role resolution, request context
	academy-config/    # Institution profile, defaults, types
	academic-calendar/ # Calendar, terms, periods
	course-catalog/    # Courses, sections, prerequisites
	people/            # Students, staff, guardians, relationships
	grading/           # Grading scales, evaluations, transcripts
	student-pwa/       # Student dashboard, LMS launch, offline
	lms-contract/      # Provider-neutral LMS interface, Moodle/Canvas adapters
	demo-feedback/     # Demo mode feedback collection
	academic-workflows/# ShepherdAI workflow recommendations
docs/                # Architecture, ADRs, product docs, factory docs
supabase/migrations/ # Postgres migrations (SQL)
```

## Architecture rules

- **Business logic lives in `src/modules/`.** API routes stay thin — resolve actor, call module, map errors.
- **No LMS runtime code in this repo.** LMS providers are adapters under `src/modules/lms-contract/`.
- **Tenant isolation is enforced in every module function before repository access.**
- **Production identity comes only from a verified Supabase session.** Never authorize with request headers or `user_metadata`.
- **Request-facing Postgres access must run through `withAcademyDatabaseContext`.** Service-role access is reserved for migrations and controlled workers.
- **Runtime pages may not import `academy-data/mock-data`.** Tests, seed commands, and explicit non-production demo mode are the only allowed seeded-data paths.
- **ShepherdAI is a deterministic signal engine.** No chatbot UI. No freeform LLM output surfaced directly to users.
- **Student PWA surfaces only released, reviewed records.** No drafts, no held records, no provider secrets.
- **Tests live next to the code they cover** under `src/modules/<domain>/__tests__/`.
- **Test data is built inline or via domain defaults helpers.** No database in unit tests.
- **Migrations are append-only.** Never edit a migration after it has been committed.

## Testing conventions

- Every module function must have: success case, validation/rejection case, cross-tenant rejection case.
- Use `node:test` + `node:assert/strict`. No Jest, no Vitest.
- Secret field names must never appear in test output (verify with `doesNotMatch`).
- Run `npm test && npm run lint && npm run build` before marking any task complete.
- **Every release ships its test surface.** A new page or API method must be registered in `e2e/surfaces/manifest.ts` (the coverage gate in `npm test` fails otherwise); a new workflow needs a journey spec in `e2e/journeys/`; a new role needs a persona in `e2e/personas.ts`. The e2e suite (`npm run test:full`, required CI check) runs them against a production build. See `docs/testing/e2e-suite.md`.
- **Full dependency testing is required.** If the feature under test depends on prior data (student, year, period, section, program), the test must create that data through the real module functions — not stubs, not raw inserts, not mock data. Testing enrollment requires creating the student, the year, the period, the course, and the section first. No workarounds. No schema shortcuts. No PII/PHI in test output. The longest road that makes everything work correctly, or do not ship.

## Don't do

- Do not log raw payment, grade, or auth payloads.
- Do not return database error messages directly to the client.
- Do not add a dependency without a reason documented in the PR description.
- Do not refactor code outside the agreed task scope.
- Do not call ShepherdAI from UI components or route handlers directly.
- Do not use `any` type unless the existing file already does.
- Do not resolve `process.env` inside module domain functions — resolve at the route layer.
- Do not catch a persistence failure and return in-memory or seeded Academy records.

## Documentation map

Before guessing, consult:

- `AGENTS.md` — cross-agent SDLC, Council, verification, and delivery rules
- `docs/architecture.md` — system boundary and domain layout
- `docs/product/faith-based-academy-master-plan.md` — product vision
- `docs/product/factory-roadmap.md` — phase plan (Phases 1–22) and sprint shape
- `docs/sdlc/academy-sdlc.md` — auditable SDLC and change-class matrix
- `docs/product/sis-competitive-research-and-expansion-roadmap.md` — competitive intelligence
- `docs/software-factory.md` — factory process (intake → delivery)
- `docs/adr/` — architecture decisions (read before contradicting one)
- `supabase/migrations/` — schema history

## GitHub discipline

- **Sole approver:** @ricardojjulia. No other approvals required or expected.
- **Branch pattern:** `feature/<phase>-<short-name>` or `fix/<short-name>`.
- **Every PR must pass** `npm test`, `npm run lint`, `npm run build` (`npm run verify` runs all three) before merge.
- **Before merging, triage review comments — CI passing is not the merge signal.** GitHub Copilot's automated review can post after status checks already show green, so a PR isn't ready just because `gh pr checks` is clean. Confirm a Copilot review has actually completed (`gh api repos/:owner/:repo/pulls/<pr>/reviews` — look for a submitted review whose login *contains* `copilot`, e.g. `copilot-pull-request-reviewer[bot]`; match with something like `test("copilot"; "i")`, not an exact-string check, since the bot's exact login can change) before treating the PR as reviewed, then:
  - Query comments with `gh api repos/:owner/:repo/pulls/<pr>/comments`, but check resolution state via the GraphQL `reviewThreads` field (`isResolved`) rather than trusting the REST list alone — REST has no resolved field and will re-show findings already addressed in an earlier round.
  - Triage every unresolved finding — security, RLS/tenant isolation, schema integrity, accessibility, assertion strictness, and any other correctness or quality concern raised, not only the categories that come up most often.
  - Fix actionable findings directly on the branch, re-run `npm run verify`, and push.
  - Mark each addressed thread resolved on GitHub, or reply explaining why it's intentionally not being addressed (false positive, out of scope, tracked separately elsewhere) — a thread should never be left silently unresolved past merge.
  - If a comment lands after merge (Copilot's review can trail CI by a few minutes), treat it exactly the same way on a new branch — don't let it go stale just because the originating PR already closed.
- **PR description must include:** what changed, why, tests added, ADR reference if applicable.
- **Squash merge to `main`.** No force-pushes to `main`.
- **`main` requires signed commits.** Without a configured signing key, every PR's merge will be blocked by branch protection ("the base branch policy prohibits the merge") even after status checks and review pass. Merging then requires `gh pr merge --admin` (squash), which bypasses the signature requirement — get the user's explicit sign-off before running it each time, never silently. This is a standing condition of this repo until a GPG/SSH signing key is configured for the commit author; don't treat it as a one-off surprise.


## Repo identity

- This repository is the **ChurchCore Academy** codebase.
- ChurchCore Academy is the **faith-based education management system and SIS** in the ChurchCore platform.
- It must support Bible schools, children's schools, seminaries, colleges, and universities through configurable academic structures rather than hardcoded college-only assumptions.
- This repository is **not** the LMS and must not contain Moodle runtime code.
- ChurchCore Learning and any LMS runtime belong outside this repository.

## Product context

**Every agent must read `docs/product/product-context.md` before writing any code or producing any plan.** It defines what ChurchCore Academy is, what actually works today, the priority build order, and what "done" means. A passing build is not done. A working workflow in the browser is done.

## Non-negotiable rules

### Rule 0 — Use the software factory for substantial work

For major features, architecture changes, LMS integration work, student PWA work, grading/transcript work, auth/privacy work, or ShepherdAI expansion, follow `docs/software-factory.md`.

The software factory is tool-agnostic and must remain compatible with Codex, GitHub Copilot, Claude Code, and similar AI coding tools. Do not make essential process depend on one vendor-specific feature.

When the active agent is Codex and Superpowers skills are available, Codex must use the relevant Superpowers skills for the work. This includes `superpowers:using-superpowers` for skill selection, `superpowers:brainstorming` for creative or product-direction work, `superpowers:writing-plans` for multi-step implementation plans, and `superpowers:verification-before-completion` before claiming implementation work is complete.

The expected path is:

1. intake
2. discovery
3. options
4. design spec
5. implementation plan
6. execution
7. verification
8. review
9. delivery

Small documentation and copy edits can be handled directly, but product direction changes must update durable docs.

### Rule 1 — No Moodle in this repo

Do not reintroduce Moodle core, Moodle plugins, or Moodle theme code here.

If a task requires Moodle customization, it belongs in the separate LMS repository.

### Rule 2 — Respect the system boundary

This repo owns:

- faith-based SIS and education management
- institution type configuration
- academic years, terms, sessions, cohorts, calendars, campuses, departments, and divisions
- course catalog, course types, course durations, sections, credits, clock hours, and prerequisites
- grading scales, grading types, GPA rules, pass/fail rules, competency or narrative grading, transcripts, and academic records
- student records and academic standing
- enrollment, transcripts, graduation, and compliance tracking
- faculty, professor, teacher, guardian, student, and administrator workflows
- institutional academic workflow orchestration
- student PWA workflows
- LMS launch orchestration from the Academy side when needed

This repo does not own:

- course delivery UI or learning engagement
- Moodle auth internals
- Moodle themes
- Moodle plugins
- Moodle database schema
- Canvas runtime internals
- LMS course delivery business logic

### Rule 3 — ShepherdAI Academy is not a chatbot

If implementing ShepherdAI in this repository:

- do implement deterministic signal detection, scoring, explainability, workflow recommendation, and optional draft generation
- do not implement a chat window, general assistant, or freeform conversational interface
- do not use or imply access to Ops, Learning, or Care data
- do not let UI components or controllers make hidden AI calls
- keep ShepherdAI product-specific to ChurchCore Academy

Required framing:

**ShepherdAI for ChurchCore Academy is an explainable Academic Workflow recommendation engine, not an AI chatbot. It uses structured faith-based SIS and education-management signals from Academy to generate Suggested Academic Workflows for human review and action, with optional LLM assistance limited to wording and administrative support content. It is product-specific and must not use or imply access to Ops, Learning, or Care data.**

### Rule 4 — Integrate through contracts

Cross-system behavior must go through explicit interfaces such as:

- SSO launch and logout
- roster and enrollment sync
- grade and progress sync
- webhook/event callbacks
- service APIs

Do not implement SIS business logic inside LMS-specific code paths.

### Rule 5 — Start simple

The repo is intentionally minimal right now. Prefer small foundational decisions over premature framework sprawl.

When adding a stack, document:

1. runtime and framework choice
2. deployment target
3. persistence model
4. auth approach
5. institution configuration model
6. SIS-to-LMS integration points
7. student PWA impact

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
