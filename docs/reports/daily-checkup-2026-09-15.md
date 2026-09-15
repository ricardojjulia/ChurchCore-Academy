# Daily Checkup Report — 2026-09-15

First run of the recurring 6am autonomous checkup. Local Supabase + `npm run dev` against the `cca-main` demo tenant. Logged in via browser as the local demo personas.

## What changed today

- **Fixed:** dashboard dead-end links to ShepherdAI for roles without access — merged, live on `main`.
- **Fixed:** `favicon.ico` 404 on every page load — merged, live on `main`.
- **Fixed (local-only):** local DB migration-tracking drift that broke `npm run db:migrate:local`.
- **Landed:** 4 pre-existing uncommitted planning docs from prior sessions.
- **Corrected:** stale "ministry formation has no admin UI" claim in two docs.
- **No new features built.** MVP status unchanged from the 2026-09-12 audit; the full 12-step core-loop walkthrough is still the top open verification task (see below).

---

## 1. Modules checked

Logged in as `admin@churchcore.academy` (roles: `institution_admin`, `registrar`) unless noted.

| Module | What was exercised | Result |
|---|---|---|
| Login / auth | Sign in as admin and student personas | Working |
| Academic Dashboard | Landing page, metrics, quick access | Working (after fix, see below) |
| Academic Calendar — Periods | `/admin/settings/calendar` (Academic Periods tab) | Working — 6 periods listed across 5 institution modes |
| Academic Calendar — Years | Academic Years tab | Working — 5 years listed |
| Course Catalog | `/admin/courses` | Working — 10 courses, 3 sections, 2 staffed |
| Programs | `/admin/programs` — index + one program detail | Working — 7 programs; opened "Bachelor of Biblical Studies" detail and curriculum |
| Program Curriculum | Curriculum section on program detail | Working — required-course list populated for the active catalog year |
| Sections & Roster | `/admin/sections` | Working — 10 sections, registration review panel with real registrants |
| Student Records | `/admin/students` | Working — 9 students, statuses, programs, credits |
| Ministry Formation | `/admin/formation`, `/admin/formation/[studentId]` | **Working — corrected a stale doc claim, see below** |
| Gradebook | `/admin/gradebook` | Working — section grade status + registrar posting queue with real draft grades |
| ShepherdAI Queue | `/admin/workflows` as `institution_admin` | **Correctly denies access** (by design) — but the dashboard was linking to it anyway, see Defect 1 |
| Student PWA | Logged in as `student@churchcore.academy` (Lena Rivera) — Home, Progress | Working — no console errors, releases-only data shown |

Not reached this run (time-boxed): Admissions, Finance/Billing, Reports, People & Roles admin, Faculty portal, Communications, LMS Providers settings, Denomination/Alumni (confirmed no UI exists — see below).

---

## 2. Defects found

### 2.1 Dashboard dead-end for non-`academic_admin` roles (fixed, merged)

`canAccessShepherdAi()` (`src/modules/academy-auth/policy.ts`) deliberately restricts ShepherdAI reads to the `academic_admin` role — this is intentional and already covered by `policy.test.ts`. But `src/app/admin/page.tsx` rendered the Recommendations/Urgent items/Active workflows metric tiles, the "Review all →" link, and the "ShepherdAI Queue" quick action as links to `/admin/workflows` for **every** staff role, regardless of access. The local demo admin (`institution_admin` + `registrar`) hit "You don't have access to this page" on every one of those links — a genuine dead end for the primary admin persona, violating the repo's own Definition of Done ("accessible from a logical navigation path — not just a known URL").

**Fix:** conditionally render those links only when `canReadShepherdAi` is true; show a plain non-clickable tile and an explanatory message otherwise. No change to the access-control policy itself.

**Tests:** new `e2e/admin-access.spec.ts` cases — `institution_admin` dashboard has zero `a[href="/admin/workflows"]` links; `academic_admin` dashboard still has the link (no regression). Both pass.

**PR:** [#108](https://github.com/ricardojjulia/ChurchCore-Academy/pull/108) — squash-merged to `main`.

### 2.2 `favicon.ico` 404 on every page (fixed, merged)

No icon metadata was declared in `src/app/layout.tsx`, so every page load requested the browser-default `/favicon.ico`, which doesn't exist (404 in the console on every navigation). Fixed by declaring `icons` metadata pointing at the existing `academy-mark.svg` / `academy-mark-192.png` brand assets — confirmed both now resolve 200.

**PR:** same as 2.1, [#108](https://github.com/ricardojjulia/ChurchCore-Academy/pull/108).

### 2.3 Local DB migration-tracking drift (fixed, local-only, no PR)

`npm run db:migrate:local` failed with `policy "tenant_isolation_mfaa" for table "ministry_formation_advisor_assignments" already exists` before any browser testing could start. Root cause: migrations `20260914010000`–`20260914030000` (ministry-formation-advisor-assignments + a non-idempotent FK-rename migration) had already been applied directly to the local DB — most likely via the Supabase MCP tools during a prior session's feature build — without going through `npm run db:migrate:local`, so the project's custom `public.schema_migrations` tracking table had no record of them even though the objects existed.

**Fix:** verified the table, policy, and FK-constraint objects for all three migrations matched what the files would produce, then manually inserted the three migration names into `public.schema_migrations`. Also found and dropped an orphaned `fk_name_test` schema (leftover manual constraint-name-collision testing) with a duplicate copy of the same table/policy.

This is a local-database-only fix — no source file changed, so no PR. Documented in memory (`project_local_db_setup.md`) so the next session doesn't have to re-diagnose it, and as a general caution: prefer `npm run db:migrate:local` over applying SQL directly via MCP tools when building migrations locally, so the tracking table stays authoritative.

### 2.4 Documentation drift: ministry-formation admin UI claimed missing, actually built (corrected)

The 2026-09-13 competitive closure plan and `docs/product/factory-roadmap.md` Phase 14 both described ministry-formation as having "no admin UI" / as pure future work. Browser-verified today: `/admin/formation` (list), `/admin/formation/[studentId]` (detail, with a real record for Joshua Keller and formation advisor "Ava Advisor"), the student-facing dashboard at `/student/formation`, and role-gated advisor assignment (`canAssignAdvisor`) are all built and working. `denomination` and `alumni` admin UI are confirmed still genuinely missing (no route, no nav entry) — that part of the prior analysis holds.

Corrected in `docs/superpowers/plans/2026-09-13-competitive-feature-closure-plan.md`, `docs/product/factory-roadmap.md`, and `docs/product/sis-competitive-research-and-expansion-roadmap.md`. Docs-only, landed in **PR [#109](https://github.com/ricardojjulia/ChurchCore-Academy/pull/109)**.

### 2.5 Draft ministry-formation evaluations exposed to students (fixed, merged) — found via automated PR review

`getStudentFormationRecord()` (`src/modules/ministry-formation/service.ts`) filtered `practicumSessions` and `milestones` to endorsed-only records for the student view, but mapped every `evaluations` row unfiltered — a draft (unreviewed) formation evaluation, including its scores, was exposed on the Student PWA. This is a direct violation of CLAUDE.md's "Student PWA surfaces only released, reviewed records. No drafts, no held records."

**How it was found:** not by this run's own browser walkthrough — the Copilot PR-review bot commented on PR #110 (this report's own PR) flagging that its "releases-only" claim for the Student PWA hadn't actually been verified against this specific code path. Investigating that comment surfaced the real bug. Worth noting for future runs: automated PR review on the report itself caught something the manual browser pass missed.

**Fix:** filter `evaluationResult.rows` to `status === "endorsed"` before mapping into the student view, matching the existing pattern for practicum sessions and milestones two lines below. Extended the existing draft-exclusion test to cover evaluations, and fixed a second test that had been accidentally relying on the draft-exposure bug (it asserted an unendorsed evaluation appeared in the student view, stripped of pastoral notes — endorsed it first instead, which is what that test actually needs).

**PR:** [#111](https://github.com/ricardojjulia/ChurchCore-Academy/pull/111) — squash-merged to `main`.

---

## 3. Test / lint / build results

```
npm test        → 1479 passed, 0 failed (49 suites)
npm run lint     → clean, 0 errors
npm run build    → compiled successfully, all routes built
npx playwright test e2e/admin-access.spec.ts -g ShepherdAI → 2 passed
```

All three required gates (`npm test && npm run lint && npm run build`) passed before either PR was opened.

---

## 4. Pull requests

| PR | Title (exact) | Classification | Status |
|---|---|---|---|
| [#108](https://github.com/ricardojjulia/ChurchCore-Academy/pull/108) | fix: stop dashboard from linking non-academic-admin roles into ShepherdAI dead end | Safe (UI-only, tested, no schema/auth-logic/tenant-isolation change, no new dependency) | **Merged** to `main` after CI passed |
| [#109](https://github.com/ricardojjulia/ChurchCore-Academy/pull/109) | docs: land pending council review and planning docs | Safe (docs-only; includes the ministry-formation correction as a follow-up commit on the same PR) | **Merged** to `main` after CI passed |
| [#110](https://github.com/ricardojjulia/ChurchCore-Academy/pull/110) | docs: add 2026-09-15 daily checkup report | Safe (docs-only) | **Merged** to `main` after CI passed |
| [#111](https://github.com/ricardojjulia/ChurchCore-Academy/pull/111) | fix: exclude draft ministry-formation evaluations from student view | Safe (isolated data-filter fix, fully tested, no schema/auth/tenant-isolation change) | Found via automated PR review on #110 — see §2.5. Status recorded in the run's chat summary; check the PR directly if reading this before it merged |

No PR was left in "needs review" status this run — nothing touched schema, auth logic, tenant isolation, or added a dependency.

---

## 5. MVP status

**No change** to the verdict in the 2026-09-12 feature audit (`docs/reviews/2026-09-12-feature-inventory-audit-and-mvp-evaluation.md`): the full Core Academic Loop (academic years/periods, course catalog, programs, program curriculum, course sections, student program membership, section enrollment, student progress, grade entry, transcript entries, student groups) is built with real Postgres-backed modules, admin UI, and tests. Today's walkthrough sampled broadly across modules rather than re-running that audit.

**Still open, unchanged:** `docs/product/product-context.md`'s own "Open verification gap" — nobody has walked the complete 12-step chain (create year → period → course → program → curriculum → section → instructor → student program membership → section enrollment → progress → grade → transcript) in one browser session in a single sitting. This remains the single highest-value next verification task per that document's own Definition of Done, and this run did not close it. **Recommended as the primary focus of the next dedicated checkup or a focused follow-up session**, since it needs sustained, uninterrupted browser time rather than the broad-sample approach used today.

---

## 6. Council-proposal / feature-gap status

No new council proposal drafted this run. The standing plan — `docs/superpowers/plans/2026-09-13-competitive-feature-closure-plan.md` — already covers "features present in other SIS platforms that Academy lacks" (vs. Populi) and was explicitly approved by the user on 2026-09-13, with execution deferred to a future session. That plan's own "Surface the Built Differentiators" fast-win package is now smaller than it was: ministry-formation is done (see §2.4), leaving denomination/ordination admin UI, alumni/giving admin UI, the competency framework builder, and academic-standing-to-holds wiring as the remaining items in that package. No execution work was started on it today — this run was scoped to checkup/fix/doc-accuracy, not new feature delivery.

**Recommendation for a future run:** once the full 12-step MVP walkthrough (§5) is closed out, the next-highest-value work is starting execution on the closure plan's already-approved "Surface the Built Differentiators" package (denomination + alumni admin UI first, per that plan's own sequencing) — but that should go through the software factory per CLAUDE.md Rule 0, not be built ad hoc inside a daily checkup run.

---

## 7. Memory / documentation updated

- `project_local_db_setup.md` — added the migration-tracking-drift pitfall and its fix
- `project_competitive_closure_plan_2026_09_13.md` — added the ministry-formation correction
- `project_daily_checkup_2026_09_15.md` — new, summarizes this run
- `MEMORY.md` — added index entry for the above
- `docs/superpowers/plans/2026-09-13-competitive-feature-closure-plan.md`, `docs/product/factory-roadmap.md`, `docs/product/sis-competitive-research-and-expansion-roadmap.md` — ministry-formation status corrected (PR #109)

---

## Needs your attention

- **All four PRs from this run (#108, #109, #110, #111) merged to `main`** — no PR was left open or needing review.
- **§2.5 (draft ministry-formation evaluations exposed to students) was a real privacy-adjacent bug that shipped to `main` before today** — it's fixed now, but worth a moment's thought on whether any real (non-demo) tenant had draft evaluations a student could have already seen before this fix. On the local demo tenant, no harm — this is the first time it was caught.
- **The full 12-step core-loop walkthrough is still not done in one sitting.** This is the top recommended focus for the next session — see §5.
- **The scheduled job itself expires around 2026-09-21** (7-day session-cron limit) and only fires while the desktop session is open and idle at 6am — renew it before then if daily runs should continue.
- Denomination and alumni admin UI remain genuinely unbuilt (§2.4) — real gap, not a doc error, whenever that work gets prioritized.
- Several modules were not reached this run (Admissions, Finance/Billing, Reports, People & Roles, Faculty portal, Communications, LMS Providers) — worth covering in a future pass.
