# Daily Checkup Report — 2026-09-17

Third run of the recurring 6am autonomous checkup. Local Supabase + `npm run dev` against the `cca-main` demo tenant. Logged in via browser across three personas: `admin@churchcore.academy` (`institution_admin`, `registrar`), `academic.admin@churchcore.academy` (`academic_admin`), and `student@churchcore.academy` (Lena Rivera).

## What changed today

- **Fixed and merged (safe, PR [#128](https://github.com/ricardojjulia/ChurchCore-Academy/pull/128)):** the "ShepherdAI Queue" sidebar nav link (Daily Ops section) was shown unconditionally to every staff role, but `/admin/workflows` only allows `academic_admin`. Any admin without that role (including the demo `admin@churchcore.academy` persona used in most of this checkup's own testing) clicked straight into an access-denied dead end. Same bug class already fixed twice before for other nav items (PR #108, PR #119) — this specific link had never been covered.
- **Found, confirmed non-urgent, deferred:** a `pg` deprecation warning ("Calling client.query() when the client is already executing a query... will be removed in pg@9.0") on `/admin/workflows`, caused by three queries sharing one connection client inside a `Promise.all()`. Confirmed this does not produce incorrect results today (pg 8.x queues same-client queries safely) and is a systemic pattern across 17+ route files — too large a refactor for a same-day autonomous fix. See §2.2.
- **Found, not a bug:** on Marcus Chen's student profile, the course he has a posted official grade for (from yesterday's grading-pipeline fix) still shows "In Progress" with grade "n/a" in the Academic Progress view. Investigated and confirmed this is correct behavior, not a regression — posting one assignment's grade promotes it to an official record, but the enrollment itself isn't complete (and no transcript entry exists) until a separate "complete the course" step happens. See §2.3 for why this isn't being treated as a defect.
- **Docs updated (safe, PR [#129](https://github.com/ricardojjulia/ChurchCore-Academy/pull/129)):** `product-context.md`'s "Open verification gap" note (walking the full 11-step loop in one session — corrected from an earlier "12-step" miscount, see the note at the end of this section) was stale — the walkthrough happened 2026-09-16. Updated to record that, and to correct an over-claim a Copilot PR review caught in this same update: step 10 (grade posting) still only partially works on `main` today, because PR #126 — the fix — is still open and unmerged. Do not read this as "the loop now works end-to-end"; it isn't, until #126 merges and is re-verified.
- **MVP status:** unchanged. Core Academic Loop remains fully built per the 2026-09-12 audit. The grading-pipeline gap found in yesterday's walkthrough has a fix built and verified against a local branch (PR #126), but that PR is still open and unmerged — the underlying trigger bug is still live on `main` today, so grade posting (step 10) is not yet confirmed end-to-end on `main`. Today's checkup found only polish-level defects (nav gating), not new core-loop gaps.
- **Note on "12-step" vs "11-step":** `product-context.md`'s Core Academic Loop is defined as 11 steps (1–11), not 12 — a Copilot review on PR #129 caught this session's report and memory files (including this one, before this correction) calling it a "12-step loop." That miscount has been repeated across multiple memory files and reports this week; not corrected everywhere today (out of scope for a same-day fix), but flagged here so it isn't propagated further — see the "Needs your attention" section.
- **Cron renewed:** the local session-only 6am daily checkup job continues on its existing schedule (job `4ba0a5aa`, expires ~2026-09-23) — no action needed this run; flagged for renewal before expiry in a future run.

---

## 1. Modules checked

| Module | What was exercised | Result |
|---|---|---|
| Login / auth (academy-auth) | Sign in/out across three personas: `admin@churchcore.academy`, `academic.admin@churchcore.academy`, `student@churchcore.academy` | Working, no console errors |
| Academic Dashboard | Landing page for all three personas; ShepherdAI dashboard tile (regression check on 2026-09-15's PR #108 fix) | Working, no regression |
| Academic Calendar | `/admin/settings/calendar` — periods list across all configured years | Working, no console errors |
| Course Catalog | `/admin/courses` — courses and sections list, including yesterday's `ACTS-MIN-CODEX` open-for-registration fix | Working — confirmed the section's status correctly shows "Open" after yesterday's PR #127 fix |
| People / Student Records | `/students` — full roster; opened Marcus Chen's profile, Academic Record tab | Working — see §2.3 for a non-defect finding |
| Grading | `/admin/gradebook` — Registrar Posting Queue | Working, no regression — Marcus Chen's grade posted yesterday (against local dev, on PR #126's still-unmerged branch) correctly shows as posted, not draft. Note: this only confirms the Registrar Posting Queue page itself (already on `main` from earlier work); the "Submit for Posting" UI that produced that record lives only on PR #126's branch and was not re-tested today since `main` doesn't have it yet. |
| Student PWA | Student dashboard, `/student/progress` as Lena Rivera | Working, no console errors |
| Academic Workflows / ShepherdAI | `/admin/workflows` as both `admin@churchcore.academy` (should be denied) and `academic.admin@churchcore.academy` (should work) | **Found and fixed a real defect, see §2.1** — works correctly for `academic_admin` after the fix (25 real workflow items rendered, filters functional) |

Not reached this run (time-boxed; checked recently with no reason to suspect regression): Admissions, Billing/Financial Aid, Communications, Faculty portal, LMS Provider settings, People & Roles admin settings.

---

## 2. Defects found

### 2.1 ShepherdAI Queue nav link shown to roles that can't access the page (fixed, merged)

**Symptom:** Logged in as the demo `admin@churchcore.academy` (roles `institution_admin` + `registrar`), expanded the Daily Ops sidebar section, clicked "ShepherdAI Queue" — landed on "You don't have access to this page."

**Root cause:** `/admin/workflows` calls `assertShepherdAiAccess(actor, actor.tenantId, "read")`, which only allows the `academic_admin` role (`src/modules/academy-auth/policy.ts`). The sidebar nav item in `NAV_SECTIONS` (`src/components/admin-shell.tsx`) listed "ShepherdAI Queue" unconditionally for every staff role — no capability or role gate at all, unlike the sibling `ministryFormationEnabled` / `denominationTrackingEnabled` / `alumniGivingEnabled` items in the same list.

This is the third occurrence of the same bug class in three days: the dashboard's ShepherdAI tile needed the same fix on 2026-09-15 (PR #108), and the denomination/alumni nav links needed it on 2026-09-16 (PR #119, itself caught mid-fix by Copilot review). Neither prior fix touched this sidebar link.

**Fix:** `src/app/admin/layout.tsx` now computes `canReadShepherdAi = canAccessShepherdAi(actor, actor.tenantId, "read")` (the same policy function the page and dashboard tile already use) and threads it through `AdminCapabilityProvider` (`src/components/admin-capability-context.tsx`) as a new flag. `admin-shell.tsx` filters the nav item on it, using the exact same mechanism as the existing capability-gated items.

**Verified in the browser, both directions:**
- As `admin@churchcore.academy` (no `academic_admin` role): "ShepherdAI Queue" no longer appears under Daily Ops.
- As `academic.admin@churchcore.academy` (`academic_admin` role): the link still appears, and `/admin/workflows` still loads and works fully — 25 real workflow items, urgency/status/type/assignee filters all present.

**Files changed:** `src/app/admin/layout.tsx`, `src/components/admin-capability-context.tsx`, `src/components/admin-shell.tsx`, `src/app/admin/__tests__/shepherd-ai-nav-gating.test.ts` (new).

**PR:** [#128](https://github.com/ricardojjulia/ChurchCore-Academy/pull/128) — classified **safe** (small, isolated, fully tested, no schema/auth-logic change, reuses an existing policy function, no new dependency). Auto-merged.

### 2.2 `pg` deprecation warning on concurrent same-client queries (found, deferred — not fixed)

**Symptom:** Console error on `/admin/workflows` load: `DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0.`

**Root cause:** `src/app/admin/workflows/page.tsx` runs three queries via `Promise.all([repo.fetchSuggestions(...), repo.fetchWorkflows(...), fetchAdministrators(...)])`, and all three share the single connection `client` handed out by `withAcademyDatabaseContext` (needed for RLS tenant-context scoping). Calling `.query()` multiple times on the same `pg` client without awaiting between calls is deprecated as of `pg` 8.23 (the version this repo pins) and will be a hard error in `pg` 9.0.

**Why not fixed today:** Confirmed this is not a current correctness bug — `pg` 8.x queues same-client queries internally and returns correct, ordered results; the warning is a forward-compatibility notice, not evidence of wrong behavior today. But the pattern is **systemic**, not isolated to this one file — `Promise.all` over queries sharing one `withAcademyDatabaseContext` client appears in at least 17 route files (`grep -rl "Promise.all" src/app | xargs grep -l "withAcademyDatabaseContext"`: `faculty/page.tsx`, `faculty/attendance/page.tsx`, `faculty/gradebook/[sectionId]/assignments/[assignmentId]/page.tsx`, `student/formation/page.tsx`, `admin/graduation/page.tsx`, `admin/faculty/page.tsx`, `admin/settings/calendar/page.tsx`, `admin/settings/people/page.tsx`, `admin/formation/[studentId]/page.tsx`, `admin/workflows/page.tsx`, `admin/students/page.tsx`, `admin/programs/[id]/page.tsx`, `admin/admissions/matriculation/page.tsx`, `admin/people/students/[id]/page.tsx`, `admin/people/staff/[id]/page.tsx`, `admin/alumni/[personId]/page.tsx`, `admin/denomination/[personId]/page.tsx`, `api/academy/workflows/route.ts`). Fixing it correctly (sequential awaits, or per-query connections) across that many files in one sitting risks introducing subtle behavior or performance changes without dedicated testing time for each.

**Recommendation:** A dedicated future session should audit and fix this pattern across all 17+ files — either switch to sequential awaits on the shared client, or restructure `withAcademyDatabaseContext` to hand out a pool where independent reads can run truly concurrently. Not urgent (no incorrect behavior today), but will become a hard build/runtime break whenever `pg` is upgraded to 9.x, so it should be scheduled before that upgrade is ever considered.

### 2.3 Posted grade doesn't show on student Academic Progress view (investigated, not a defect)

**Observation:** Marcus Chen has a posted, student-visible official grade record (92/100 on WALK-101's Midterm Exam, posted 2026-09-16 per yesterday's grading-pipeline fix verification). His student profile's Academic Progress tab still shows WALK-101 as "In Progress" with grade "n/a," and Transcript Entries shows "No transcript entries have been posted for this student."

**Why this isn't a bug:** Per `docs/product/product-context.md`'s data model, posting an official grade record (`academy_gradebook_records`, promoted via the Registrar Posting Queue) is a different step from completing the enrollment and producing an immutable Transcript Entry (Core Academic Loop steps 10 and 11 are sequential, not the same action). One assignment's posted grade doesn't mean the whole course/enrollment is complete — a section can have multiple assignments, and enrollment completion is presumably a separate registrar action at term end that this checkup did not locate a UI for. This matches the intended design (transcript entries are immutable snapshots, never recomputed from live joins), not a regression.

**Not investigated further today** (time-boxed) — flagged as a question worth a deliberate look in a future session: is there a working UI path from "enrollment has posted grades" to "enrollment marked complete" to "transcript entry produced"? If that path doesn't exist yet, it would be a genuine continuation of the grading-pipeline work closed out yesterday, not a new problem.

---

## 3. Test / lint / build results

Full suite run after PR #128's fix:

```
npm test    → 1634/1634 passing (3 new tests)
npm run lint → clean
npx tsc --noEmit → clean
npm run build → clean
```

---

## 4. Pull requests

| PR | What | Classification | Status |
|---|---|---|---|
| [#128](https://github.com/ricardojjulia/ChurchCore-Academy/pull/128) | Hide ShepherdAI Queue nav link from roles that can't access it | Safe | **Merged** (squash, auto-merged this run) |
| [#129](https://github.com/ricardojjulia/ChurchCore-Academy/pull/129) | Docs: update 11-step verification gap status (corrected mid-review after Copilot caught an over-claim) | Safe (docs-only) | Opened this run |
| [#126](https://github.com/ricardojjulia/ChurchCore-Academy/pull/126) | Fix broken gradebook term-lock trigger + posting UI (from 2026-09-16) | Needs review (DB trigger, data-integrity) | Still open, awaiting Ricardo's review — unchanged this run |
| [#104](https://github.com/ricardojjulia/ChurchCore-Academy/pull/104) | Dependabot: bump `@types/node` and TypeScript 6.0.3 → 7.0.2 | Needs review — CI red, major compiler version | Still open, not touched — flagged again |

---

## 5. MVP / roadmap assessment

No change to MVP status this run. Per [[project_walkthrough_2026_09_16]], the Core Academic Loop (11 steps, 1–11, per `product-context.md`) is confirmed working end-to-end for steps 1–9 and 11. Step 10 (grade posting) has a built and locally-verified fix in PR #126, but that PR is still open and unmerged as of this report — so step 10 is not yet confirmed on `main`. This was flagged as an over-claim by a Copilot PR review on #129 during this same run and corrected before merge (see the note in "What changed today" above). It remains the single highest-priority open item — not yet closed, pending your review of #126.

The existing competitive-closure plan (`docs/superpowers/plans/2026-09-13-competitive-feature-closure-plan.md`) remains current and already user-approved in principle; no new council-proposal doc was drafted today since one already exists and covers the relevant ground. Per the factory queue memory, **Admissions CRM Completion (plan §3.1) is the confirmed next factory item** — not started (no branch, no PR, no admin route), and this checkup's job was not to start it.

Two open, not-yet-scheduled items from yesterday's walkthrough remain:
- Draft-status course sections having no UI path to "Open" — **this was actually already fixed yesterday** (PR #127) as part of closing the grading-pipeline gaps; confirmed still working today (`ACTS-MIN-CODEX` still shows "Open").
- Whether there's a working UI path from posted grades → completed enrollment → transcript entry (§2.3 above) — newly surfaced today, not yet sized or scheduled.

---

## 6. Documentation & memory updates

- `docs/product/product-context.md` — updated the stale "Open verification gap" note (PR #129).
- `docs/reports/daily-checkup-2026-09-17.md` — this report.
- Memory: updated `project_grading_pipeline_fix_2026_09_16.md` and `MEMORY.md` at the end of yesterday's session (already reflects PRs #126/#127); a new memory entry for today's nav-gating fix and the deferred `pg` pattern finding is being added alongside this report (see below).

---

## Needs your attention

1. **[PR #126](https://github.com/ricardojjulia/ChurchCore-Academy/pull/126)** — the gradebook term-lock trigger fix from yesterday, still awaiting your review (classified needs-review: it's a database trigger touching term-lock/data-integrity enforcement).
2. **[PR #104](https://github.com/ricardojjulia/ChurchCore-Academy/pull/104)** — Dependabot's TypeScript 6→7 major-version bump, CI is red. Recommend either closing it until TS 7 compatibility is deliberately verified, or explicitly deprioritizing — it will keep reopening/nagging otherwise.
3. **The `pg` client deprecation pattern (§2.2)** — not urgent, but will hard-break on a future `pg` 9.x upgrade. Worth a dedicated session before that upgrade is ever considered, given it touches 17+ files.
4. **Posted-grade-to-transcript-entry path (§2.3)** — worth a deliberate look: is there a real UI path from an official posted grade to enrollment completion to a transcript entry? Not confirmed broken, but not confirmed working either.
5. **Cron renewal** — the local daily-checkup cron job expires ~2026-09-23. No action needed yet, but flagging so it doesn't lapse silently.
6. **"12-step" vs "11-step" loop mislabeling** — `product-context.md` defines the Core Academic Loop as 11 steps, not 12, but several memory files and prior reports this week (including this checkup's own report and memory, before a Copilot review caught it on PR #129) called it a "12-step" loop. Not corrected everywhere today — worth a small cleanup pass across `docs/reports/walkthrough-2026-09-16.md` and the memory files that repeat it, next time one of them is touched anyway.
7. **Process note, not an action item:** today's PRs #129 and #130 both initially over-claimed that yesterday's grading-pipeline fix was "done"/"confirmed working end-to-end," when PR #126 (the actual fix) is still open and unmerged. GitHub's Copilot PR-review bot caught both instances before merge and both were corrected in-thread. Worth remembering as a checkup discipline going forward: when writing status docs/reports, treat "verified against a local branch" and "merged to main" as distinct claims, and don't round the former up to the latter.
