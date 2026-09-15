# Council Review 16 - Ministry Formation Admin UI

Date: 2026-09-14
Branch: feature/fast-wins-ministry-formation-ui
Baseline: b441f30aca8f88d06919592b358a9125a2b5cca0 (diffed against main)
Scope: PR #105 — admin UI for the ministry-formation module (practicum, faith milestones, evaluations, endorsement), new formation-advisor assignment feature, read-only student formation dashboard, and a display-only formation-completion badge on the graduation-readiness page. First item in the approved "Surface the Built Differentiators" competitive closure plan (`docs/superpowers/plans/2026-09-13-competitive-feature-closure-plan.md`, Section 2 / Section 5 item 1).
Decision Requested: ship / revise / defer / split / reject

## Executive Verdict

Decision: **revise**
Release status: not yet released; code-complete pending fixes
Confidence: high — every finding below is backed by a specific file/line or a command actually run by a councilor or by this synthesis, not by agent self-report

This is real, well-built work — tenant isolation, RBAC, the advisor one-to-one constraint, and the module's business logic are all sound and thoroughly tested (1387/1387 passing, lint and build clean, CI green on PR #105). But it should not merge as-is. Seven independent council passes converged on the same handful of problems from different angles, and one of them — the student-facing page displaying draft/unendorsed formation records — was verified directly against the code during synthesis and is a confirmed violation of a CLAUDE.md non-negotiable rule, not a suspected one. The fixes required are bounded and contained to already-built surfaces; none require a new design-spec cycle.

## Evidence Reviewed

- Branch diff: `git diff main...feature/fast-wins-ministry-formation-ui --stat` (14 files, 2354 insertions, 4 deletions)
- `src/modules/ministry-formation/service.ts`, `types.ts`, `__tests__/service.test.ts` (read in full by multiple councilors)
- `src/app/admin/formation/page.tsx`, `src/app/admin/formation/[studentId]/page.tsx`, `src/app/student/formation/page.tsx`, `src/app/admin/graduation/page.tsx` (diff)
- `src/components/formation/{practicum,milestones,evaluations,formation-advisor}-tab.tsx`
- `src/app/api/academy/ministry-formation/{assign-advisor,students}/route.ts`
- `supabase/migrations/20260914010000_ministry_formation_advisor_assignments.sql`
- `docs/adr/0045-ministry-formation-records-model-privacy-boundary.md`
- `docs/superpowers/plans/2026-09-13-competitive-feature-closure-plan.md`
- Commands run independently across councilors and synthesis: `npm test` (1387/1387 pass, multiple runs), `npm run lint` (clean, multiple runs), `npm run build` (clean, confirmed by Operations councilor and PR #105 CI), `git diff --check` (clean), `grep` across the codebase for `NEXT_PUBLIC_APP_URL`, `process.env`, `AcademicRecordAuditEvent`, and role-set definitions
- GitHub Actions on PR #105: "Test, lint, and build" — SUCCESS
- Prior review: none for this module; ADR-0045 is the governing prior decision

## Council Role Findings

### Product and Market Councilor

Findings: Workflows are genuinely wired end-to-end, not screen-only (verified log/record/endorse/assign flows all persist through real service functions). Institution-mode empty states are handled gracefully. The graduation-readiness "Formation Status" badge renders unconditionally for every student and reads "Incomplete" for anyone without a formation record — indistinguishable from "behind on requirements," which is wrong for non-ministry-track students at any institution. The admin UI has no navigation entry anywhere and is only reachable by typing the exact URL. Independently discovered that the student-facing page displays Draft/Endorsed badges for unendorsed practicum sessions and milestones, while its own footer claims drafts are not shown.
Risks: Sales-demo and real-registrar credibility risk from the badge; adoption risk from zero discoverability; privacy/trust risk from the draft-record exposure, specific to a faith-based institution context.
Recommendation: revise — bounded fixes to already-built surfaces (nav entry, badge scoping, draft filtering), no re-spin needed.

### SIS Domain Councilor

Findings: Domain model, tenant isolation, and the grading-records boundary are correct — `git diff` against `src/modules/grading-records/` is empty, confirming `evaluateAcademicStanding()` was untouched. The academic-advisor and formation-advisor concepts are clearly and consistently separated in both data and UI. Independently found the same self-referential-HTTP-fetch pattern the Architecture Councilor flagged (see below) in all four read-side pages, and confirmed via grep that these four files are the only ones in the entire `src/app` tree using `NEXT_PUBLIC_APP_URL`. Also independently found zero nav entries in `admin-shell.tsx` or `student-pwa-shell.tsx`, and no institution-mode/capability gating despite ministry formation being seminary/Bible-school-specific domain content.
Risks: Same as Architecture's self-fetch risk; feature ships functionally invisible; renders for every institution type including ones where "ordination milestone" is meaningless.
Recommendation: revise.

### Architecture Councilor

Findings: The new service functions (`assignFormationAdvisor`, `listStudentsWithFormationSummary`) and their API routes are correctly thin and pattern-consistent — no `process.env` in module domain functions, no repository-pattern deviation, idempotent upsert, migration is genuinely append-only and additive. However, all four read-side pages (`admin/formation/page.tsx`, `admin/formation/[studentId]/page.tsx`, `student/formation/page.tsx`, and the graduation-page diff) fetch their own app's API over HTTP with `process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"` instead of calling the already-available module function in-process inside the `withAcademyDatabaseContext` block each page already has or could trivially have — a pattern that exists nowhere else in the codebase (confirmed by grep) and silently degrades to a wrong `localhost:3000` target in any environment where that env var isn't set exactly right. Two of the four pages swallow fetch failures into an empty/false state with no visible error. Also found the graduation-badge completion threshold (100 hrs / 3 milestones) is business logic embedded directly in a page component rather than in `src/modules/`.
Risks: Plausible-looking-but-broken-in-production deployment risk; unnecessary latency/complexity; duplicated-logic risk if the threshold rule is ever needed elsewhere.
Recommendation: revise. No new ADR required for the advisor-assignment feature itself (not sensitive pastoral content, doesn't touch the ADR-0045 boundary); a short addendum to ADR-0045 to reconcile pre-existing table-name/permission-model drift is worth doing separately but is out of scope for this PR.

### Security and Privacy Councilor

Findings: The `pastoralNotes` stripping boundary itself is correct and completely verified — traced the exact mapping code (`service.ts:826-850`) confirming the field is dropped at the object-construction step, not merely left undefined, and confirmed the acceptance test uses `assert.doesNotMatch` against real seeded pastoral content, not an empty-field false pass. Guardian denial is confirmed individually for all seven service functions by reading each role-allowlist, not by trusting the test alone. Cross-tenant validation on both sides of advisor assignment (student and advisor independently) is confirmed with dedicated tests for each. Found a genuine new gap: `admin/formation/[studentId]/page.tsx` runs two raw SQL queries directly in the page component with no role check, reachable by a student viewing their own record — meaning a student can load the full staff admin UI shell (all four tabs, a "Pastoral Notes" labeled staff form, and the full tenant's faculty/advisor/institution_admin roster with names and ids) even though no pastoral content or cross-tenant data actually leaks (service-layer stripping and RLS both independently hold). Also flagged that advisor reassignment has no audit trail (the upsert silently overwrites the prior assignment's provenance) and that `formationViewerRoles` grants tenant-wide read access not scoped to advisees, per ADR-0045's stated (but not implemented) access matrix — both pre-existing gaps this PR extends rather than introduces.
Risks: Medium — access-control layering gap exposing a staff UI shell and staff roster to an unauthorized-for-that-surface actor, even though no sensitive data crosses the boundary. Low-medium — no reassignment audit history for a formation-adjacent relationship.
Recommendation: revise — a small, contained fix (page-level viewer-role gate, move the two inline queries behind a permission-checked service function).

### UX and Accessibility Councilor

Findings: Empty states, accessibility (label association, Dialog focus handling, real interactive elements), responsive layout, and Nocturne component consistency are all solid and evidenced directly from source, matching the established `admin/people/advisors` pattern. Endorsed-record immutability is correctly reflected in the UI (empty table cell, no edit affordance) in all three tabs, confirmed by quoting the actual conditional rendering. Independently corroborated the error-swallowing problem: three pages collapse 403/500 responses into false-empty or false-not-found states rather than surfacing them, bypassing the app's own working `admin/error.tsx` boundary. The formation-advisor person-picker is a real, labeled, alphabetically-sorted native select of names (not raw IDs as initially worried) but won't scale past a small roster without search.
Risks: Highest — error-state masking hides real outages/permission failures as "no records," including on the graduation page where a transient fetch failure would silently read as universal "Incomplete." No browser click-through evidence exists anywhere in this chain.
Recommendation: revise, scoped specifically to error-state handling — not a redesign.

### Operations and Release Councilor

Findings: Migration is additive-only and safe without a seed update (ministry-formation tables were never seeded, even before this PR). `git diff --check` clean. Ran `npm test` (1387/1387), `npm run lint` (clean), and `npm run build` (clean, exit 0) fresh, and cross-referenced PR #105's GitHub Actions run (SUCCESS). `CHANGELOG.md` has an empty `[Unreleased]` section this PR doesn't populate. `docs/product/factory-roadmap.md` line 489 is now stale (still describes the UI/advisor-assignment gap as open) and is confirmed untouched by this branch's diff. No new logging was added, but this is consistent with the module's pre-existing zero-logging convention, not a regression. No down-migration exists anywhere in the repo's convention (forward-repair-migration is the documented recovery path), so this isn't a gap specific to this PR.
Risks: Product-status docs will be actively wrong immediately after merge unless updated; no browser/role walkthrough was performed.
Recommendation: ship, from a pure release-mechanics standpoint, contingent on two same-day doc follow-ups (CHANGELOG entry, factory-roadmap correction). This role's "ship" is narrower in scope than the overall council decision — see Decision below.

### Testing and Code Health Councilor

Findings: New tests for `assignFormationAdvisor` and `listStudentsWithFormationSummary` meet CLAUDE.md's three-case minimum (success, RBAC/validation rejection, cross-tenant rejection) with citations to each test by name and line. `doesNotMatch` is used correctly against real serialized pastoral content, not a weaker check. No `any` type or SQL-injection pattern introduced. Test pattern (injected mock DB client) is consistent with this module's pre-existing convention, not a new corner-cut — though this means the actual SQL (joins, aggregates, the `on conflict` upsert) is never executed against a real query planner in any test, a pre-existing module-wide risk this PR extends rather than introduces. `npm test`: 1387/1387. `npm run lint`: clean. Working tree confirmed clean of unrelated files on the actual committed diff (the stray docs/`.sync.ffs_db` files present in the working directory are not part of this PR's commit).
Risks: SQL correctness (joins/aggregates/upsert) is unverified by any test against a real database — pre-existing pattern risk, not new.
Recommendation: ship, from a pure test-coverage/code-health standpoint, contingent on the Operations Councilor's build confirmation (which came back clean). This role's "ship" is also narrower in scope than the overall council decision — see Decision below.

## Blockers

1. **[Critical, confirmed directly during synthesis, not just alleged]** `getStudentFormationRecord()` (`src/modules/ministry-formation/service.ts:705-786`) returns practicum sessions and faith milestones to students with no status filter — draft and endorsed records are both returned. `src/app/student/formation/page.tsx` (net-new in this PR, lines 195-198, 240-243) explicitly renders a "Draft" badge for these records, while the same page's own footer (line 300) states "Draft records and staff-only notes are not displayed" — which is false as shipped. This is a direct violation of CLAUDE.md's non-negotiable rule: "Student PWA surfaces only released, reviewed records. No drafts, no held records, no provider secrets." Owner: backend/frontend fix in this PR's scope, since this PR is what makes the pre-existing service-layer gap reachable and visible for the first time. Evidence required: filter to endorsed-only in the student branch of `getStudentFormationRecord()` (the correct fix point — the boundary belongs in the service layer, not client-side), plus a new acceptance test proving a draft record is never returned to a student actor.
2. **[Security and Privacy]** `src/app/admin/formation/[studentId]/page.tsx` runs two unguarded raw SQL queries (student name lookup, eligible-advisor roster lookup) with no role check, reachable by a student viewing their own record, exposing the staff admin UI shell and the tenant's full faculty/advisor/institution_admin roster. Owner: frontend fix. Evidence required: explicit viewer-role gate at the top of the page (mirroring `hasFormationViewerAccess`/`formationViewerRoles`), and move both inline queries behind a permission-checked service function.
3. **[Architecture, SIS Domain, UX Councilors — independently corroborated]** Four pages use a self-referential HTTP fetch to the app's own API (`process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"`) instead of an in-process module call, with silent error-swallowing on two of them and a misleading `notFound()` on a third. Owner: frontend fix. Evidence required: replace with direct calls to `listStudentsWithFormationSummary`/`getStudentFormationRecord` inside each page's `withAcademyDatabaseContext` block, and distinguish real 403/500 failures from a genuinely empty result.
4. **[SIS Domain, Product and Market — independently corroborated]** Zero navigation entries anywhere for `/admin/formation` or `/student/formation` — the feature is reachable only by typing the exact URL, undercutting the "surfaces the built differentiator" framing. Owner: frontend fix. Evidence required: nav entries added to `admin-shell.tsx` (e.g. under Registrar) and `student-pwa-shell.tsx`.

## Required Factory Work

- Prompt: "Fix Council Review 16 blockers on `feature/fast-wins-ministry-formation-ui`: (1) filter draft/unendorsed practicum and milestone records out of the student-facing branch of `getStudentFormationRecord()` and add a proving test; (2) add a viewer-role gate to `admin/formation/[studentId]/page.tsx` and move its two inline SQL queries behind a permission-checked service function; (3) replace the `NEXT_PUBLIC_APP_URL` self-fetch pattern in all four read-side pages with direct in-process module calls, and stop swallowing 403/500 into false-empty states; (4) add nav entries for the new routes."
  Scope: the four blockers above only — no new design-spec cycle, no scope expansion.
  Verification: re-run `npm test`, `npm run lint`, `npm run build`; add/confirm a test proving drafts never reach a student actor; re-run implementation-validator against this review's blocker list specifically before re-requesting council sign-off.
- Non-blocking, bundle into the same revise pass since it's already open: move the graduation-badge completion threshold out of `admin/graduation/page.tsx` into `src/modules/ministry-formation/service.ts`, and don't render/count the badge as "Incomplete" for students with zero formation records (distinguish not-applicable from behind).
- Follow-up tickets (do not block this PR): institution-mode/capability gating decision for ministry-formation UI; advisor-reassignment audit history; scoping `formationViewerRoles` to advisees per ADR-0045's stated access matrix; CHANGELOG.md `[Unreleased]` entry; `docs/product/factory-roadmap.md` line 489 correction; gitignore `.sync.ffs_db`.

## External Gates

None. This is entirely code-level work with no provider activation, external approval, or production data dependency.

## Decision

The council decision is `revise`.

Two of seven roles (Operations and Release; Testing and Code Health) recommended ship within their own narrower lane — release mechanics and test/code-health respectively — and both are correct on their own evidence: tests, lint, build, and CI are genuinely clean. But five of seven roles, spanning product, domain, architecture, security, and UX, independently converged on blocking issues, and one of them (the draft-record exposure to students) was confirmed directly against the source during synthesis as a violation of a non-negotiable CLAUDE.md rule. That overrides the two narrower "ship" recommendations. This is a `revise`, not a `reject`: every blocker is a bounded, contained fix to an already-built surface, not a rethink of the approach.

## Follow-Up Artifacts

- ADR: none required for this PR's scope. A separate, later addendum to ADR-0045 to reconcile its stated table names/`ministry_formation_reviewer` permission model against what's actually implemented is worth doing but is pre-existing drift, not something this PR introduces or must resolve.
- Release note: pending — write once blockers are fixed and this is ready to ship, labeled "working vertical slice" per the council's maturity vocabulary (code-complete and test/build-verified, not yet browser-verified or pilot-observed).
- Prompt: see Required Factory Work above.
- Plan: none beyond the bounded fix list above.
- Runbook: none required.
