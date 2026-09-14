# Feature Inventory Audit and MVP Evaluation

Date: 2026-09-12
Branch: main (commit `59f4719` and prior)
Scope: Full-repository, code-level audit of feature completeness against `docs/project-status.md` and `docs/product/product-context.md` claims, cross-checked against actual `src/` implementation, tests, and UI.

## Why this audit happened

Two "canonical" documents in this repo disagreed with each other:

- `docs/project-status.md` (dated 2026-06-30) claims broad "Implemented And Verified" coverage across admissions, billing, financial aid, reporting, communications, Student PWA, faculty/guardian portals, full Moodle/Canvas LMS integration, and ShepherdAI.
- `docs/product/product-context.md` (a newer document — its own browser-verification notes go as late as 2026-07-09) contains a "Current Honest State" table claiming several Core Academic Loop items — Program Curriculum, Student Program Membership, Section Enrollment, Student Progress, Grade Entry, Transcript Entries — **do not exist**, and that Course Sections are **read-only**.

CLAUDE.md instructs every agent to treat `product-context.md` as the authoritative "what actually works today" reference. Given the direct contradiction, neither document could be trusted at face value, so this audit verified against the actual code instead of either document.

## Methodology

Three parallel code-level investigations (one per domain cluster), each instructed to open real files rather than infer from filenames or comments, and to report per feature: whether a real Postgres-backed module exists, whether a navigable UI page exists, and whether dependency-chain test coverage exists (per this repo's own "no mock shortcuts" testing convention). Findings were spot-checked directly against the filesystem before being written up here.

## Finding zero: `product-context.md`'s "Current Honest State" table is stale, and wrong in the pessimistic direction

All six modules it claims don't exist are real, substantial, Postgres-backed implementations, each with a working admin UI and a `__tests__/` directory:

- `src/modules/program-curriculum/`
- `src/modules/student-program-memberships/`
- `src/modules/student-section-enrollments/`
- `src/modules/student-program-progress/`
- `src/modules/grading-records/` (gradebook)
- `src/modules/transcript-entries/`

All are dated 2026-07-09 on disk — the same day product-context.md's own changelog references ("Student Groups — browser-verified 2026-07-09"). The most likely explanation: this batch of work shipped that day and the "Current Honest State" table was never updated afterward.

**Consequence:** any agent following CLAUDE.md's instruction to trust this doc would either re-build features that already exist, or under-sell the product's real maturity when planning. This audit's findings supersede that table; `product-context.md` has been corrected to match (see below).

## Feature Inventory

### Core Academic Loop (product-context.md's own definition of what must work before anything else matters)

| # | Item | Module | UI | Tests | Verdict |
|---|------|--------|----|----|---------|
| 1 | Academic Year CRUD | `academic-calendar` | `/admin/settings/calendar` | Yes | Working |
| 2 | Academic Period add/edit/transition/delete | `academic-calendar` | `/admin/settings/calendar/years/[id]` | Yes | Working |
| 3 | Context Picker (persistent year+period) | `academic-calendar` (user-context-repository) | admin layout/provider | Yes | Working |
| 4 | Course Catalog CRUD | `course-catalog` | `/admin/courses` | Yes | Working |
| 5 | Program Management CRUD | `academic-programs` | `/admin/programs`, `/admin/programs/[id]` | Yes | Working |
| 6 | Program Curriculum (versioned by entry year) | `program-curriculum` | embedded in `/admin/programs/[id]` | Yes | Working |
| 7 | Course Sections create/edit | `course-catalog` | `/admin/sections` + `SectionFormDialog` | Yes | Working |
| 8 | Student Program Membership | `student-program-memberships` | `StudentProgramMembershipDialog` on student detail | Yes | Working |
| 9 | Section Enrollment | `student-section-enrollments` | `StudentSectionEnrollmentDialog` on student detail | Yes | Working |
| 10 | Student Progress vs. requirements | `student-program-progress` | `StudentProgramProgressCard` on student detail | Yes | Working |
| 11 | Grade Entry | `grading-records` / gradebook | `/admin/gradebook`, `/faculty/gradebook` | Yes | Working |
| 12 | Transcript Entry (immutable snapshot) | `transcript-entries` | `/admin/transcripts` | Thin (6 tests) | Working, lower coverage |
| 13 | Student Groups (cohorts) | `student-groups` | `/admin/groups` | Yes | Working |

**The full Core Academic Loop is built and wired end-to-end.** This is the single most consequential finding — the product's own docs said otherwise. Open item: nobody has confirmed the *complete chain in one browser session* (create program → curriculum → enroll student → section → register → progress → grade → transcript); each link is independently verified, but product-context.md's own definition of done asks for the full walk.

### Admissions, Money, Communications, Compliance

| Area | Backend | UI | Tests | Verdict |
|---|---|---|---|---|
| Admissions (application→decision) | Real | `/admin/admissions` (no public applicant portal) | 73 tests | Working, admin-side only |
| Enrollment Conversion | Real, idempotent | API-only, no dedicated page | Good | Working, no dedicated UI |
| Billing (ledger, manual payment, Stripe boundary) | Real | `/admin/billing` (no student checkout UI) | 27 tests | Built, gated — live settlement needs external approval |
| Financial Aid | Real | `/admin/financial-aid`, `/student/aid` (read-only) | 45 tests | Built, gated — federal/regulated aid needs compliance validation |
| Reporting | Real | `/admin/reporting` with CSV export | 32 tests | Built, self-disclaimed — IPEDS explicitly labeled "review-required," not certified |
| Communications | Real queue | `/admin/communications` + student/guardian centers | 23 tests | Built, gated — live email/SMS provider needs evidence/approval |
| Attendance | Real | admin + student + faculty pages | 48 tests | Working, no gate |

### Platform, LMS, ShepherdAI, Portals

| Area | Verdict | Notes |
|---|---|---|
| LMS Contract + Moodle/Canvas adapters | Real, gated | Actual `fetch()`-based HTTP clients with retry/circuit-breaker, not stubs. Activation genuinely blocked behind a Postgres-backed approval workflow (`activation-requests.ts`) — the gate is real, not aspirational. |
| ShepherdAI | Working, genuinely deterministic | Zero LLM/OpenAI/Anthropic/Bedrock calls found anywhere in the module — rule-based signal aggregation only. Complies with CLAUDE.md's "not a chatbot" rule as written today. |
| Student PWA | Working, feature-complete | All 11 promised surfaces render real Postgres-backed data with release-status filtering. |
| Faculty Portal | Working | Real instructor-scoped queries (`primary_instructor_id`), no mock data. |
| Guardian Portal | Working, scoped | Real guardian-relationship enforcement; restricted records show a real access-denial state, not a silent leak. |
| Institution capability enforcement | Working | `assertCapability()` / `withCapabilityContext()` spot-checked across multiple routes, consistent. |
| Auth / tenant isolation | Solid foundation | Session-scoped Postgres context (`set_config`) backing RLS; no unscoped queries found. |

**Unresolved:** `project-status.md` claims "Ghost Mode (HTTP 451)" as part of the Council Review III capability-enforcement closeout. This audit's search did not find it in code. That is a single negative search result, not a confident "it doesn't exist" — needs a direct, targeted check before either claim is relied on.

## MVP Evaluation

**This is a substantially more complete MVP than either of its own status docs claims — just not a GA-ready one, and for reasons that are governance/compliance gates, not missing engineering.**

**Genuinely done:** The full Core Academic Loop — the thing product-context.md itself says is the only thing that matters — works end-to-end with real data, real tests, and real UI. Admissions, attendance, faculty/student/guardian portals, and institution capability enforcement are all real and functioning, not shells.

**Built but intentionally not live:** Billing, financial aid, communications, and LMS provider activation are all functionally complete but deliberately switched off pending external approval — sandbox evidence, provider signoff, or regulatory validation. This is a release-management posture, not an engineering gap, and it's consistent with `project-status.md`'s own "controlled-pilot, not GA" stance.

**Thin:** Transcript entry test coverage (6 tests vs. 25–75 elsewhere in comparable modules) and the lack of a single browser-verified walk of the complete core-loop chain in one sitting.

**Missing outright:** A public applicant portal (admissions is admin-only), a student billing checkout UI. No other load-bearing gaps were found.

## Recommendations, in priority order

1. ~~Fix `docs/product/product-context.md`'s "Current Honest State" table~~ — done as part of this audit (see below).
2. Do one browser-verified walk of the full 12-step Core Academic Loop in a single session and record it as evidence — the one thing product-context.md asks for that genuinely hasn't happened.
3. Add cross-tenant/rejection test depth to `transcript-entries` to match the rest of the codebase's convention.
4. Directly verify whether Ghost Mode (HTTP 451) exists in code or was superseded by a different mechanism, and correct whichever doc is wrong.
5. Everything else (LMS provider activation, live payments, live email/SMS, federal aid) is a go/no-go business and compliance decision, not an engineering task.

## Status of this audit

This is the current authoritative feature-completeness reference for ChurchCore Academy as of 2026-09-12. `docs/project-status.md` and `docs/product/product-context.md` have been updated to point here and to reflect these findings. Treat any future claim in either document that contradicts this audit as suspect until re-verified against code, the same way this audit treated its predecessors.
