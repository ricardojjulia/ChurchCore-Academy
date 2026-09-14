# Council Review 18 - Admin Page Authorization Gate

Date: 2026-09-14
Branch: fix/admin-page-authorization-gate
Baseline: c9e302b (first pass), fixes landed in 86c6464 (diffed against origin/main)
Scope: PR #106 — a standalone security fix adding authorization checks to 41 admin pages that previously called `requireActor()` with no role argument (authentication only), letting any authenticated user, including a `student` or `guardian`, load any admin page and read its data.
Decision Requested: ship / revise / defer / split / reject

## Executive Verdict

Decision: **revise → fixed**
Release status: not yet released; two regressions and several gaps found and fixed, all verified directly rather than taken on report
Confidence: high — the two most severe findings were independently confirmed by direct testing in an isolated worktree, not just cited by reviewing agents

The authorization fix's core intent — closing a real, 41-page information-disclosure gap — was correct and well-evidenced from the first pass. But the first pass shipped two genuine regressions: an infinite redirect loop for every blocked non-staff user, and an uncaught authorization error breaking normal login for faculty, teacher, professor, and advisor roles (a large, actively-used population) on their very first post-login page load. Both were found by independent council reviewers and confirmed directly before fixing. One additional review finding (a missing role in the baseline allow-list) turned out to be a cross-branch artifact from an isolation failure in the review process itself — reviewing agents shared a working directory without worktree isolation, and at least one ended up reading a different branch's files while believing it was reviewing this one. That specific claim was verified false for this branch and not acted on.

## Evidence Reviewed

- `git diff origin/main fix/admin-page-authorization-gate --stat` at both `c9e302b` and `86c6464`
- `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/error.tsx`, `src/lib/require-actor.ts` (full reads, both before and after fixes)
- `src/app/page.tsx`, `src/app/login/login-form.tsx` (traced the full login → landing → gate chain)
- `src/modules/academy-auth/policy.ts` (`AcademyRole`, `PlatformRole`, `assertInstitutionConfigAccess`)
- `src/modules/academic-calendar/period-lifecycle-service.ts` (the legitimate `PlatformRole` break-glass call site the typing fix had to accommodate)
- Existing test precedent: `src/app/__tests__/working-surface-pages.test.ts`, `src/app/admin/gradebook/__tests__/page-source.test.ts`, `src/app/admin/settings/lms/__tests__/page-source.test.ts`
- Commands run, fresh, in an isolated `git worktree` (not the shared session working directory): `npm test` (1373/1373 at baseline, 1424/1424 after fixes), `npm run lint` (clean both passes, one error found and fixed mid-pass), `npm run build` (clean both passes, one type error found and fixed mid-pass — see Architecture note below)
- Direct verification of contested claims: `grep -n "ministry_formation_reviewer" src/modules/academy-auth/policy.ts` on this branch (no match — confirms one review finding was a cross-branch artifact), `grep -n -A 8 "export function assertInstitutionConfigAccess"` (confirmed bare `Error`, not `AcademyAuthorizationError`), `cat src/app/admin/error.tsx` (confirmed exact pre-fix copy), `grep -n "router.push\|redirect" src/app/login/login-form.tsx` (confirmed unconditional `router.push("/")`)

## Council Role Findings

Four review passes covered all seven roles (combined per pass given session scale): Product/Market + SIS Domain; Security and Privacy; Architecture + Testing and Code Health; UX/Accessibility + Operations/Release.

### Product and Market + SIS Domain

Independently found and precisely traced the redirect loop: `layout.tsx`'s `redirect("/?error=unauthorized")` on authorization failure, combined with `src/app/page.tsx`'s unconditional `redirect("/admin")`, loops forever for any blocked non-staff actor — and cited this exact codebase's own git history of having hit and fixed this precise failure shape once before (`src/app/page.tsx`'s prior "Fix redirect loop on admin dashboard" commit). Also found that `login-form.tsx` pushes every role to `/` unconditionally with no `next`-param handling, meaning the loop is not a rare edge case but the default outcome of every non-staff login. SIS Domain's role-by-role audit of all 41 pages found the per-page role assignments were otherwise sound (14 files spot-checked, all correct), with one now-confirmed-invalid claim (a role that doesn't exist on this branch) and two legitimate but non-blocking least-privilege follow-ups (see below).

### Security and Privacy

Confirmed the baseline gate itself has no bypass: synchronous throw, no cross-catch between the two sequential try/catches, no Next.js route-group escape hatch, tenant isolation untouched, no role-spelling typos in this PR's own role lists. Flagged the loose `roles: string[]` typing as providing no compile-time protection against a future typo, zero test coverage for the fix itself, and — the finding that turned out to be a cross-branch artifact — a role from a different, unmerged branch missing from the baseline list. That specific claim was independently verified false for this branch during synthesis (the role doesn't exist in this branch's `AcademyRole` type at all) and not acted on; it remains a valid consideration for whenever this branch and the ministry-formation branch are merged together, already tracked in that other PR's description.

### Architecture + Testing and Code Health

Confirmed the `layout.tsx` actor-resolution refactor is behavior-preserving, found reusing `assertInstitutionConfigAccess` for settings pages throws a bare, untyped `Error` rather than `AcademyAuthorizationError` (a real inconsistency, addressed by making the error boundary detect both by message convention rather than type), and — via a `sort -u` audit across all 41 files, not just spot-checking — found zero role-list inconsistencies or typos in the original pass. Recommended "ship" for the fix itself on the grounds that consistency held under audit, but flagged the uncaught-error-to-crash-screen pattern (affecting 40 of 41 pages) and missing test coverage as required near-term follow-up, correctly identifying that this repo already has an established `page-source.test.ts` convention for exactly this kind of regression coverage that the first pass should have used.

### UX/Accessibility + Operations/Release

Independently traced and confirmed the exact same redirect loop and, going further, traced the complete login chain to show the admin dashboard's role exclusion breaks the *default* post-login experience for faculty/teacher/professor/advisor — not an edge case, the normal path. Found the existing regression test (`working-surface-pages.test.ts`'s "legacy root page redirects to admin portal") only pins the redirect's existence via a regex on source code, providing zero protection against this exact class of behavioral regression. Confirmed clean rollback shape (single commit, no migrations), confirmed the PR description was otherwise clear and well-scoped, and confirmed fresh build/test/lint were clean at the pre-fix commit.

## A note on this review's own process

Council Review 18's four review agents ran without git-worktree isolation, sharing the same working directory as the orchestrating session at a point when that directory had already been switched to a different branch for unrelated reasons. This produced at least one contaminated finding (the `ministry_formation_reviewer` role claim, verified false for this branch). The two most severe, load-bearing findings — the redirect loop and the dashboard role exclusion — were independently corroborated by two separate review passes each, and both were re-verified directly in a properly isolated worktree before any fix was made, which is why they're trusted here despite the process gap. Future council rounds reviewing a specific commit/branch should use `isolation: "worktree"` for every reviewing agent, not just the orchestrating session's own verification steps.

## Blockers (both confirmed via direct, isolated re-verification; both fixed in 86c6464)

1. **Infinite redirect loop for every blocked non-staff actor.** `redirect("/?error=unauthorized")` plus `src/app/page.tsx`'s unconditional `redirect("/admin")` loops forever. Fixed with a role-aware redirect (student → `/student`, guardian → `/guardian`, applicant → `/apply`, safe fallback → `/login`).
2. **Uncaught authorization error breaks normal login for faculty/teacher/professor/advisor.** The admin dashboard (the default post-login landing page) excluded these roles from its own role list. Fixed by expanding the dashboard's role list to the full staff baseline, since it's a general landing page rather than sensitive data.

## Fixed alongside (bundled into the same pass since the branch was already open)

- `requireActor`'s two-arg overload retyped from `roles: string[]` to `roles: (AcademyRole | PlatformRole)[]` — the union because an existing legitimate break-glass call site (`period-lifecycle-service.ts`) checks a `PlatformRole`; narrowing to `AcademyRole` alone broke that call site, caught by the build during this fix pass.
- `admin/error.tsx` now detects the "Forbidden" message convention (shared by `AcademyAuthorizationError` and `assertInstitutionConfigAccess`'s bare `Error`) and shows a clear access-denied message instead of a generic crash screen, for all 40 non-dashboard pages at once.
- Removed a dead `AcademyAuthenticationError` catch branch in `layout.tsx` — the zero-arg `requireActor()` already redirects internally on that error; the branch could never execute.
- Page-source regression tests added for all 41 pages plus the layout gate, the root-page loop-risk documentation, and the error boundary, following this repo's own existing `page-source.test.ts` convention. Direct unit tests added for `requireActor`'s two-arg overload.
- `CHANGELOG.md` entry.

## Follow-up tickets (do not block this PR)

- `assertInstitutionConfigAccess` throws a bare `Error` rather than `AcademyAuthorizationError` — inconsistent with the rest of the auth surface; not changed here because it's shared with API-layer error mapping that depends on its exact throw shape, and changing it is out of this PR's bounded scope.
- `admissions` role is granted on `staff`/`guardians`/`advisors` people-pages, not just `applicants`/`students` — broader than strictly necessary, though strictly narrower than the pre-PR state (no check at all). Worth tightening in a follow-up, not a regression.
- `src/app/admin/settings/people/page.tsx` is a vestigial redirect-only page now gated more narrowly than the page it redirects to (`/admin/people`) — an inconsistency, not a security hole (fails closed), worth cleaning up.
- 41 files each hardcode their own role-list array; centralizing into named constants (e.g. `BILLING_ROLES`, `PEOPLE_RECORD_ROLES`) would reduce future-typo risk further, now that the type system catches spelling but not category drift.

## External Gates

None. Recommend a manual login check with `student`, `guardian`, and `faculty` test accounts before merge, per the PR's own test plan — no browser tool was available to any reviewer or fixer in this session.

## Decision

The council decision is `revise`, now resolved. Both blockers are fixed and independently re-verified (fresh `npm test`: 1424/1424, `npm run lint`: clean, `npm run build`: clean, all run in an isolated worktree). Ready for the manual role walkthrough named above, then merge.

## Follow-Up Artifacts

- ADR: none required — this is a bug fix restoring the codebase's own existing, already-documented authorization pattern, not a new architectural decision.
- Release note: pending, once the manual walkthrough confirms the fix in a real browser.
- Prompt: see Follow-up tickets above.
- Plan: none beyond the bounded fix list.
- Runbook: none required.
