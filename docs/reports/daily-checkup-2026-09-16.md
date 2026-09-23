# Daily Checkup Report — 2026-09-16

Second run of the recurring 6am autonomous checkup. Local Supabase + `npm run dev` against the `cca-main` demo tenant. Logged in via browser as the local demo admin and student personas.

## What changed today

- **Fixed:** three admin pages shipped in yesterday's "Surface the Built Differentiators" factory work (`/admin/denomination`, `/admin/alumni`, `/admin/settings/grading`) had no sidebar nav entry at all — reachable only by typing the exact URL. Added nav entries. Denomination and alumni are gated by both institution capability AND the destination page's own role allowlist. *(Correction 2026-09-23: grading was not. It has no capability flag and was shown to every staff role, while `/admin/settings/grading` only allows institution_admin, dean, registrar and academic_admin, so faculty, admissions and finance got a dead-end link. Fixed in the 2026-09-23 System nav role-gating PR, together with the other System-section links.)*
- **Found via PR review and fixed before merge:** the first version of that nav fix only checked capability, not role — would have shown the new links to staff roles the destination page then rejects (the exact dead-end-link bug class this checkup fixed yesterday, reintroduced by today's own first attempt). Caught by the Copilot review bot, fixed in a follow-up commit on the same PR.
- **Found, documented, deferred:** the Admissions application queue renders raw `programId` (e.g. `prog-biblical-studies`) instead of the program's display name — a minor cosmetic defect that needs a repository-level join across several files, judged too large for a same-day fix; see §2.2.
- **No new features built.** Confirmed academic standing automation (the confirmed next item in the factory queue) has not started — no branch, no PR, no admin route.
- **MVP status:** unchanged — Core Academic Loop still fully built. The 12-step end-to-end walkthrough is still not done in one sitting (see §5) — flagged again as the top recommended focus for a future dedicated pass.

---

## 1. Modules checked

Logged in as `admin@churchcore.academy` (roles: `institution_admin`, `registrar`) unless noted.

| Module | What was exercised | Result |
|---|---|---|
| Login / auth | Sign in as admin and student personas | Working |
| Academic Dashboard | Landing page, ShepherdAI gating (regression check on yesterday's fix) | Working, no regression |
| Denomination & Ordination (new, shipped yesterday) | `/admin/denomination` — direct load | Working, but undiscoverable — **fixed today, see §2.1** |
| Alumni & Giving (new, shipped yesterday) | `/admin/alumni` — direct load | Working, but undiscoverable — **fixed today, see §2.1** |
| Grading settings / competency framework builder (extended yesterday) | `/admin/settings/grading` — direct load | Working, but undiscoverable — **fixed today, see §2.1** |
| Ministry Formation | `/admin/formation` | Working, nav entry already existed |
| Student PWA — Home, Formation | Logged in as `student@churchcore.academy` (Lena Rivera) | Working, no console errors, no regression from yesterday's draft-evaluation-exposure fix |
| Admissions | `/admin/admissions` | Working — **found a minor cosmetic defect, see §2.2** |
| Reports | `/admin/reporting` | Working, no console errors |

Not reached this run (time-boxed): Finance/Billing, People & Roles admin, Faculty portal, Communications, LMS Providers settings, Course Catalog/Programs/Sections/Gradebook (all checked yesterday, no reason to suspect regression), Academic Calendar.

---

## 2. Defects found

### 2.1 Denomination, Alumni, and Grading-settings pages had no nav entry (fixed, merged — two-round PR review)

Yesterday's factory work shipped three real, working admin pages (PR #114 denomination/ordination, PR #116 alumni & giving, and PR #117's extension of the pre-existing `/admin/settings/grading` page with a competency/narrative evaluation framework builder). All three rendered correctly when loaded by direct URL — but **none had a sidebar nav entry**, so a real admin using the app normally would never find them. This is the same class of defect CLAUDE.md's Definition of Done calls out explicitly: "accessible from a logical navigation path — not just a known URL."

**Fix, round 1:** extended the existing `ministryFormationEnabled` capability-gating pattern (`AdminCapabilityProvider` / `useAdminCapabilities`) with `denominationTrackingEnabled` and `alumniGivingEnabled`, added "Denomination & Ordination" and "Alumni & Giving" to the Registrar nav section, and "Grading" to the System nav section. Opened PR #119.

**Found by Copilot PR review, fixed in round 2 before merge:**
1. **Role-gating gap** — round 1 only checked the institution capability flag, not the destination page's own narrower role requirement (`/admin/denomination`: `institution_admin`/`registrar` only; `/admin/alumni`: `institution_admin`/`academic_admin`/`alumni_relations`/`registrar` only). A `faculty`, `admissions`, or `finance` user has the capability enabled and baseline `/admin/*` access, so they'd have seen both new links and landed on an access-denied page on click — the exact dead-end-link bug this checkup fixed yesterday for ShepherdAI, reintroduced by this fix's own first attempt. Fixed by exporting each destination page's role allowlist as a named const (`DENOMINATION_ROSTER_ROLES`, `ALUMNI_ROSTER_ROLES`) instead of an inline array literal, so `admin/layout.tsx` imports the exact same list instead of a hand-typed copy, and ANDs it with the capability check server-side before exposing the nav-visibility flag.
2. **Weak test assertions** — the new e2e tests only asserted "no access-denied text visible," which a 404 or the generic crash-boundary page would also satisfy without actually proving success. Fixed by asserting a page-specific `<h1>` heading instead.

Both review threads were addressed and marked resolved before merging.

**Tests:** `e2e/admin-access.spec.ts` gained 4 new cases — nav link visible + navigates to a real success heading for `institution_admin` (denomination, alumni, grading), plus a case confirming `faculty` sees neither denomination/alumni nav link and is still blocked server-side on direct navigation to either URL. Also fixed two source-assertion tests broken by the role-list refactor (this codebase's established Server Component testing convention): `src/app/admin/alumni/__tests__/page-acceptance.test.ts`'s CRITERION 1 test, and the repo-wide `src/app/admin/__tests__/page-authorization.test.ts` sweep's shared detection regex (now accepts either an inline array literal or a named role-list const, still correctly rejects the bare zero-arg `requireActor()` it exists to catch).

`npm test`: 1610 passed. `npm run lint`: clean. `npm run build`: clean. `npx playwright test e2e/admin-access.spec.ts`: 13/13 passed.

**PR:** [#119](https://github.com/ricardojjulia/ChurchCore-Academy/pull/119) — squash-merged to `main` after both review rounds were addressed.

### 2.2 Admissions queue shows raw `programId` instead of program name (found, documented, not fixed today)

`src/components/admissions-application-list.tsx` renders `{application.programId}` directly in the Program column (e.g. `prog-biblical-studies` instead of "Bachelor of Biblical Studies"). Traced the data flow: `AdmissionReviewItem` (`src/modules/admissions/review-model.ts`) only carries `programId`, sourced from `AdmissionApplication` (`src/modules/admissions/types.ts`), which also has no name field. Fixing this properly requires joining `academy_programs` (the legacy text-id table that `AdmissionApplication.programId` references, not the UUID-keyed `academy_academic_programs`) somewhere in the admissions repository/query layer, threading a new `programName` field through the type, the review-model, and the component — and updating whatever tests cover that shape.

**Why not fixed today:** this touches the repository layer across several files, which is more than the "small, isolated, quick fix" this checkup's safe-fix policy is scoped for, even though it's low-risk (read-only enrichment, no schema/auth/tenant-isolation change). Documenting it here rather than expanding scope mid-run. Cosmetic only — doesn't block the actual conversion workflow, which already works correctly (verified: 4 accepted applications, all correctly showing "Converted" with real student numbers).

**Suggested fix for a future pass:** add a `programName` (or full program object) to whatever query builds `AdmissionApplication[]`, threading it through `review-model.ts` and the list component. Small backend + presentation change, testable the same way as the rest of the admissions module.

---

## 3. Test / lint / build results

```
npm test        → 1610 passed, 0 failed (62 suites)
npm run lint     → clean, 0 errors
npm run build    → compiled successfully, all routes built
npx playwright test e2e/admin-access.spec.ts → 13 passed
```

All three required gates passed before the PR was opened, and again after each review-driven follow-up commit.

---

## 4. Pull requests

| PR | Title (exact) | Classification | Status |
|---|---|---|---|
| [#119](https://github.com/ricardojjulia/ChurchCore-Academy/pull/119) | fix: add nav entries for denomination, alumni, and grading settings pages | Safe (small, isolated, UI-only wiring on existing infrastructure, fully tested, no schema/auth-logic/tenant-isolation change, no new dependency) | **Merged** to `main` after two rounds of CI + PR review, both review threads resolved |

No PR was left in "needs review" status this run.

---

## 5. MVP status

**No change** to the verdict from the 2026-09-12 feature audit — the Core Academic Loop remains fully built. Yesterday's factory work (ministry-formation, denomination, alumni, competency/narrative grading admin UIs) and today's nav-discoverability fix further strengthen the competitive-parity picture (see `docs/superpowers/plans/2026-09-13-competitive-feature-closure-plan.md`, now fully up to date through PR #119).

**Still open, unchanged from yesterday:** `docs/product/product-context.md`'s own "Open verification gap" — the complete 12-step core-loop chain (create year → period → course → program → curriculum → section → instructor → student program membership → section enrollment → progress → grade → transcript) has still not been walked in one browser session in a single sitting. This remains the single highest-value next verification task and was not closed by this run — today's checkup instead surfaced and fixed a real navigation-discoverability regression from yesterday's factory work, which took priority as a live, user-facing defect. **Recommended as the primary focus of a future dedicated checkup**, ideally one not competing with fresh factory output that needs same-day verification.

**Factory queue status (not this checkup's scope, tracked for context):** per `project_factory_queue_2026_09_15` memory, academic standing automation is the confirmed next factory item (wiring the existing `academic-standing-evaluator.ts` backend to registration holds/SAP + a standing-change notification workflow) — confirmed today to have not started (no branch, no PR, no admin route). Admissions CRM Completion is queued after that, per the user's explicit 2026-09-15 confirmation.

---

## 6. Council-proposal / feature-gap status

No new council proposal drafted this run — the standing closure plan (approved 2026-09-13) remains the active reference and continues to be executed through the software factory in separate sessions, not this checkup. Nothing in today's findings changes its sequencing.

---

## 7. Memory / documentation updated

- `project_factory_queue_2026_09_15.md` — added today's confirmation that academic standing automation hasn't started, and a pointer to this report
- `project_daily_checkup_2026_09_16.md` — new, summarizes this run
- `MEMORY.md` — added index entry for the above
- `docs/superpowers/plans/2026-09-13-competitive-feature-closure-plan.md` — addendum noting the nav-discoverability gap (and its two-round fix) is now closed

---

## Needs your attention

- Nothing is blocked on you — PR #119 merged cleanly after addressing its own review feedback.
- **The full 12-step core-loop walkthrough is still not done in one sitting** — two days running now. Worth explicitly scheduling a session for just this, separate from the daily checkup's broader-but-shallower sampling.
- **Admissions queue shows raw program IDs instead of names** (§2.2) — minor, cosmetic, not blocking, but a real small backend+UI fix worth picking up whenever convenient.
- The recurring local cron job (`58b73497`) still expires around **2026-09-21** — five days out now.
- Several modules were not reached this run (Finance/Billing, People & Roles, Faculty portal, Communications, LMS Providers) — worth covering in a future pass, though none of them changed yesterday so regression risk is lower than for the newly-shipped pages this run focused on.
