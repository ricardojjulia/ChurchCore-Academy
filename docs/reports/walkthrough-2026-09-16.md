# Full 11-Step Core Academic Loop Walkthrough — 2026-09-16

> **Correction (2026-09-23):** this report originally called the loop "12-step". `docs/product/product-context.md` defines the Core Academic Loop as steps 1–11. Step 12 there, Student Groups, sits in a separate section and was not part of this walkthrough. The §1 verification summary and the §3.2 conclusion have also been narrowed to match the evidence; see the notes inline. The §3.2 gap itself was later closed by PR #126 and PR #133.

Follow-up session after the daily checkup, done at the user's request to (1) verify the previous run left nothing behind, and (2) work through that report's "needs your attention" list — including, for the first time, the complete 11-step Core Academic Loop from `docs/product/product-context.md` in one sitting.

## What changed today (this session)

- **Confirmed clean:** previous daily-checkup run left no stray branches, processes, or uncommitted state. `npm test`/`lint`/`build` and migration tracking all verified healthy before starting.
- **Fixed (PR [#123](https://github.com/ricardojjulia/ChurchCore-Academy/pull/123), merged):** Admissions queue showed raw `programId` instead of the program name — the deferred item from yesterday's report.
- **Fixed (PR [#124](https://github.com/ricardojjulia/ChurchCore-Academy/pull/124), merged, 3 commits + 1 review round):** five real, independent defects found by actually walking the 11-step loop instead of sampling pages:
  1. Academic period creation was completely broken (404 on every submission).
  2. Every academic period status transition (Open Enrollment / Activate / Complete) was completely broken (404).
  3. `CourseFormDialog`'s required-field validation failed completely silently (no error message, no request, no feedback).
  4. The admin Gradebook's "Enter grades" link went to Attendance Entry, not grading.
  5. Assignment creation (`/faculty/gradebook/[sectionId]/assignments/new`) had never worked — the route didn't exist, and once built, the underlying `createAssignment()` function turned out to have a NOT NULL database column it never populated, meaning it had never actually succeeded even when called directly.
- **Found and documented, not fixed:** a major architectural gap in the grading pipeline — see §3.

## 1. What was verified working, end to end, for the first time

Using a freshly created academic year, period, course, program, section, and an existing student (not just pre-seeded demo data), each core-loop step was exercised live in the browser and confirmed to actually persist and connect correctly:

| Step | Action | Result |
|---|---|---|
| 1 | Create Academic Year | Working (after browser interaction workaround; see §4) |
| 2 | Add Academic Period to the Year | **Broken → fixed** (§2.1) |
| 3 | Create a Course in the Catalog | **Broken → fixed** (§2.2, silent validation) |
| 4 | Create a Program with a Required Course List | Working |
| 5 | Create a Course Section within the Period | Working |
| 6 | Assign an Instructor to the Section | Working (done as part of section creation) |
| 7 | Enroll a Student in the Program | Working |
| 8 | Enroll the Student in the Section | Working — but only after discovering sections default to "Draft" status with **no UI path to open them for registration** (see §3.1) |
| 9 | Track Student Progress | Working — correctly shows the new course as "Required / core, in progress" against the program's required credits |
| 10 | Record a Grade for the Enrollment | **Partially broken → partially fixed** (§2.3); the assignment-level "submission" now works, but see §3.2 for why it doesn't become an official grade |
| 11 | Produce a Transcript Entry | **Not verified** — blocked by §3.2, not something this session could complete through the UI |

Steps 1–9 were exercised end-to-end against newly created data, not just seeded data, several of them only *after* today's fixes. Two exceptions: step 8 depended on opening the section by calling the API directly, since no UI path existed (§3.1), so it was not browser-verified end to end; and step 11 was not verified at all. This closes the specific verification gap `product-context.md` has flagged as open since (at least) the 2026-07-03 verification dates it currently cites.

## 2. Defects found and fixed

### 2.1 Academic period creation and every status transition were completely broken

`CreatePeriodButton.tsx` (the create dialog on the main `/admin/settings/calendar` page) POSTed to `/api/academy/periods`, a route that has never existed — 404 on every submission, silently. `PeriodActions.tsx`'s Open Enrollment / Activate / Complete actions PATCHed `/api/academy/periods/:id/status`, equally nonexistent. Only Delete worked, because it already used the correct route. The correct nested routes (`/api/academy/calendar/years/:yearId/periods[/…]`) already existed and were already used correctly by a sibling component (`years/[id]/CreatePeriodDialog.tsx`) — this component had simply never been brought up to the same standard. Also added the missing `periodType`/`sequence` fields the backend requires (previously hardcoded/absent), and — found via PR review — the date-overlap warning the backend returns on success was being silently discarded; ported the sibling dialog's warning-display flow to fix that too.

### 2.2 Course creation failed completely silently on a missing required field

`CourseFormDialog`'s required-field validation (`react-hook-form`) correctly blocked submission when the Description field was empty, but the form never read `formState.errors`, so clicking "Create Course" simply did nothing — no request, no toast, no visual change of any kind. Confirmed via a direct `form.requestSubmit()` that the native submit event fired but the validated callback never ran. This is a real, reproducible dead end for any admin who fills in every visually-obvious field but skips the one without an asterisk or placeholder hint. Fixed by rendering a visible message under each required field.

### 2.3 The Gradebook's assignment-grading flow had never worked, in three layers

1. `/admin/gradebook`'s "Enter grades" link was hardcoded to `/faculty/attendance` (attendance entry) instead of the section's actual gradebook — for every section, not just the ones created today.
2. That destination's own "Add Assignment" link pointed at `/faculty/gradebook/[sectionId]/assignments/new`, a route that never existed — Next.js matched `"new"` against the sibling `[assignmentId]` dynamic segment instead, crashing with `invalid input syntax for type uuid: "new"` on every click. Built the missing page and form.
3. Submitting that new form surfaced a deeper bug: `createAssignment()`'s INSERT statement never populated `assignment_type`, a `NOT NULL` database column with its own `CHECK` constraint and no default — the function has **never** successfully created a row, in this database's lifetime, through any path. The module's own unit tests never caught this because their mocks hand back a pre-shaped fixture that was never validated against the real schema (the same pattern flagged repeatedly in yesterday's differentiator work). Wired `assignmentType` through the types, all three queries that reference it, the API route's validation, and the new form.

## 3. Found, not fixed — flagged for a deliberate follow-up

### 3.1 New course sections default to "Draft" with no UI path to open them

A freshly created section cannot receive student registrations until its status is "Open," but there is no button, menu, or dialog anywhere in the UI to make that transition — the backend endpoint (`PATCH /api/academy/courses/:courseId/sections/:sectionId/status`) is fully built and works correctly (confirmed by calling it directly), but nothing in `src/app/admin/sections` or `src/components` calls it. Worked around today by calling the API directly to unblock the rest of the walkthrough; a real user has no way to do this. Same shape as the ministry-formation/denomination/alumni pattern from the past few days — backend complete, frontend never wired — but this one blocks the single most central workflow in the product (a brand-new section can never accept students).

### 3.2 The path from a graded assignment to an official transcript-eligible grade has a missing link — the most significant finding of this session

Tracing exactly what happens after a faculty member enters a grade revealed that ChurchCore Academy currently has **three loosely-connected grading surfaces**, not one pipeline:

1. `/faculty/gradebook/[sectionId]` (ADR-0054, fixed today) — faculty create assignments and record grades. This writes to `academy_gradebook_submissions` (a "here's a proposed grade" record) via `bulkGradeAssignment()`. **Confirmed working today.**
2. `/dashboard/faculty/gradebook` (a completely separate, older route tree — also `/dashboard/admin/gradebook`, `/dashboard/instructor/gradebook`, `/dashboard/student/grades`, `/dashboard/learner/grades`) — has a "Grade Entry Queue" that promotes a submission into an official `academy_gradebook_records` row via the already-implemented `submitGradeAction()`. **This is the only place that function is ever called from.** It exists, loads, and is real — but **has zero navigation entry anywhere in the current `admin-shell.tsx` sidebar**, so nothing in the visible app links to it. Tested logged in as the demo admin: the queue showed no pending submissions for that identity.
3. `/admin/gradebook`'s "Registrar Posting Queue" — posts an already-official `academy_gradebook_records` row (status `draft`) to student-visible status via `postGradeAction()`. **Confirmed working** against pre-seeded data (the Daniel Hart / Naomi Price rows already visible there).

The practical effect: a faculty member using only the app's visible navigation can create an assignment and record a grade for it (stage 1), but has **no discoverable way to reach stage 2**, and this session could not exercise stage 2 with the seeded identities. That makes the path from stage 1 to an official record undiscoverable and unverified, not impossible: `submitGradeAction()` can create an official `academy_gradebook_records` row, and the student-detail transcript-entry UI consumes posted records. There is a second, separate handoff gap: transcript candidates also require an `academy_gradebook_course_summaries` row (joined in `src/modules/transcript-entries/postgres-repository.ts`), and neither the new assignment path nor the submit path writes one. *(Both gaps were closed later: PR #126 fixed the official-record write path, and PR #133 wired `submitDraftFinalGrade`, which writes the course-summary row.)* Compounding this, no demo course instructor (e.g., Miriam Stone, the instructor on the section used throughout this walkthrough) has a login account in the seeded tenant at all, so even a direct link to stage 2 might be untestable as things are currently seeded.

**This is not something to patch with another URL fix.** It's a real product/architecture decision — likely, at minimum: (a) decide whether the `/dashboard/*` route tree is the intended long-term home for this stage or legacy debris from an earlier UI generation, (b) either link it from the current nav or migrate its logic into the `/admin` + `/faculty` tree that's actually linked today, and (c) make sure at least one demo instructor account exists so this can be verified end-to-end going forward. Recommended as a dedicated software-factory pass (Rule 0), not a daily-checkup fix.

## 4. Minor findings, not investigated further

- **Off-by-one date display:** dates entered when creating an Academic Year and an Academic Period both displayed one day earlier than entered (e.g., entering 8/20/2027 showed as 8/19/2027). Consistent with the UTC-parsing pattern already flagged and fixed once in the alumni module (`formatDate` in `src/app/admin/alumni/page.tsx`) — worth checking whether the same fix needs to be applied to the calendar display code.
- **Grade-entry roster shows raw person IDs, not names:** the assignment grade-entry page (`AssignmentGradeEntryForm`) displayed `demo-multi-student-k12` instead of "Marcus Chen." Confirmed the underlying registration data is correct (that ID is genuinely Marcus Chen's — a leftover naming artifact from when the seed persona was created for an unrelated scenario, not a data bug) — this is purely a display issue.
- **Browser-automation flakiness this session:** several form submissions silently failed to fire network requests on the first attempt, later traced to the dev server mid-rebuilding from Turbopack Fast Refresh (observed rebuild times up to 148 seconds and 7.6 seconds during active testing) rather than any application bug — worth knowing if a future session sees the same symptom.

## 5. Test / lint / build results

```
npm test        → 1627 passed, 0 failed (62 suites)
npm run lint     → clean, 0 errors
npm run build    → compiled successfully, all routes built (incl. the new assignments/new route)
```

All green before every merge in this session.

## 6. Pull requests

| PR | Title | Status |
|---|---|---|
| [#123](https://github.com/ricardojjulia/ChurchCore-Academy/pull/123) | fix: show program name instead of raw programId in admissions queue | **Merged** |
| [#124](https://github.com/ricardojjulia/ChurchCore-Academy/pull/124) | fix: repair broken academic period, course-form, and gradebook flows found via full walkthrough | **Merged**, 3 commits, addressed 1 review round (overlap-warning handling) |

No PR was left open or needing review.

## 7. MVP status

**Meaningfully strengthened, not just reassessed.** Steps 1–9 of the Core Academic Loop are now verified working end-to-end through real browser interaction — several only after today's fixes — closing the specific gap `product-context.md` has called its single highest-value open verification task for the last two daily-checkup runs. Step 10 (grading) is real but incomplete: the entry mechanics work, but the path to an official grade has a genuine, non-trivial gap (§3.2). Step 11 (transcript entry) remains unverified as a direct consequence.

**Recommendation:** §3.2 (the fragmented grading pipeline) is now the single most important open item for this product — more significant than any other finding across the last three days of checkups, because it means grading — one of the Core Academic Loop's 11 steps — cannot currently be completed by a real user through the visible app, however correct each individual piece is in isolation. Recommend scoping this as its own factory pass before further feature work (e.g., Admissions CRM Completion), since "can a faculty member actually grade a student" is more foundational than any competitive-parity feature.

## Needs your attention

- **§3.2 — the grading pipeline gap** is the top item. Needs a product decision (consolidate `/dashboard/*` into the current nav, or replace it) before it can be fixed, not just another patch.
- **§3.1 — no UI to open a Draft section for registration** — real, blocks a core workflow, backend already built.
- The off-by-one date display issue (§4) is worth a quick check against the known-fixed `formatDate` pattern in the alumni module.
- The recurring local cron job (`58b73497`) still expires around **2026-09-21**.
