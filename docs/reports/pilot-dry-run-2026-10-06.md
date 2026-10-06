# Pilot Dry Run — 2026-10-06

Status: operator dry run, not participant evidence.

An agent operator ran the 14 tasks in `docs/acceptance/uncoached-pilot-session.md` against the local stack before inviting a real participant. The goal was to find S0/S1 blockers and environment problems in advance so a participant's session isn't spent on them. The operator knows the codebase, so this does not measure how discoverable the product is. It does not replace the uncoached session.

## Environment

- Academy commit: `2df6138` (`main`, after PR #221), served by `npm run dev` on `localhost:3200` (loopback).
- Local Supabase on `127.0.0.1:56321` / `56322` (loopback). No real student, guardian, payment, or pastoral data.
- Browser: headless Chromium (Playwright), 1366×900.
- `npm run verify:pilot-readiness`: PASS. `npm run verify:role-walkthrough`: PASS (49 steps).

## Environment findings (fix before the participant session)

| Finding | Effect | Action |
| --- | --- | --- |
| The local DB was 12 migrations behind `main` (graduation clearance through HQ platform RLS), but `verify:pilot-readiness` still passed. | Student profile pages crashed with an error screen. | Ran `npm run db:migrate:local`. **Follow-up:** the readiness check should fail when migrations are pending. |
| Leftover records from the 2026-09-16 walkthrough ("Walkthrough Test Year 2027-2028", "Walkthrough Fall Term", "Overlap Test Term") are the admin's selected year and period. | Task 1's answer is a test year. Faculty load and other period-scoped pages show test data. | Reset and reseed the local DB before the session (needs owner approval; it wipes local data). |
| 5 of 9 seeded students have no program. The seeded student (Lena Rivera) has no released courses or schedule. | Tasks 2 and 11 return mostly empty answers. | Seed programs, registrations, and released schedule items for the demo students. |
| No application is awaiting a decision (1 draft, 4 accepted). | Task 5 can't be done as written. | Seed one submitted application. |

## Task results

| Task | Role | Outcome | Observation | Severity |
| --- | --- | --- | --- | --- |
| 1 | admin | friction | Year/period picker is on the dashboard, but defaults to leftover test data (above). | env |
| 2 | admin | friction | Student Records is easy to find. Profile shows "B.A. Biblical Studies" in the header and enrollment block, but "Program Membership: Pending assignment" further down, two answers to one question. The student's name in the list is not a link; only "Open record" is. | S2 / S3 |
| 3 | admin | pass | Reports → Reporting holds saved custom reports and CSV export. | — |
| 4 | admin | friction | Faculty load is under the **Daily Ops** menu, while the dashboard files it under **Academics**. | S3 |
| 5 | admissions | blocked (data) | Decisions queue is reachable but empty. | env |
| 6 | admissions | pass | Admissions → Enrollment lists 4 accepted applicants awaiting enrollment. | — |
| 7 | registrar | pass | Registrar → Transcripts and the student profile are reachable. | — |
| 8–10 | faculty | **blocked** | Faculty logins landed on the admin dashboard, where 18 of 20 visible links led to "You don't have access". The working faculty portal (`/faculty`) exists but nothing led there. | **S1 — fixed in this branch** |
| 8–10 | faculty | friction | In `/faculty`, the home page counts 11 sections and the attendance picker lists every section, while My Sections and Schedule show 0 assigned. The attendance service correctly rejects unassigned sections, so this is misleading, not a data leak. | S2 |
| 11 | student | friction (data) | All pages load; most are empty because nothing is released for the seeded student. | env |
| 12 | guardian | pass | Linked student and progress are visible. | — |
| 13 | student, guardian | pass | `/admin` and its subpages send both back to their own portal. | — |
| 14 | staff | pass | The concealed HQ route returns 404 for staff, students, and guardians. | — |

## S1 fixed: links shown to roles that can't open them

A crawl of every staff role's dashboard cards and nav menus found access-denied dead ends for most roles:

| Role | Dead links before | After |
| --- | --- | --- |
| faculty | 18 of 20 | 0 (lands on `/faculty`) |
| teacher | 19 of 20 | 0 (lands on `/faculty`) |
| advisor | 18 of 21 | 0 |
| ministry formation reviewer | 18 of 20 | 0 |
| finance | 15 of 20 | 0 |
| admissions | 13 of 21 | 0 |
| academic admin | 7 of 29 | 0 |
| institution admin, registrar | 1 (Student Portal card) | 0 |

This is the fourth time this bug class has shipped (PR #108, #120, #128), each time fixed one link at a time because the nav, dashboard, and page guards kept separate role lists. The fix in `fix/role-aware-navigation`:

- `src/lib/admin-route-access.ts` is now the single role map. Each role-gated admin page guards with its own entry, and the nav and dashboard hide links whose entry excludes the actor.
- Users whose roles are all teaching roles (faculty, teacher, professor) land on `/faculty`, and the faculty portal hides its admin link for them.
- The dashboard's "Student Portal" card is removed. It redirected every staff role back to `/admin`.
- `e2e/admin-nav-links.spec.ts` fails if any staff persona can see a link it can't open. Unit tests fail if a role-gated page stops using its map entry, or if a new nav/dashboard link isn't role-checked.

## Owner decision: academic admins and formation records

`academic_admin` was on the ministry formation viewer list, but the formation list and per-student record had no ADR-0045 scope for it, so both always rejected it. The owner decided on 2026-10-06 that academic admins get the registrar's records-office view: endorsed records across the tenant, no drafts, never pastoral notes. Recorded in ADR-0079 and shipped in the same PR.

## Pilot data prepared (local only)

After the reset, the missing records were created through the app's own APIs as seeded staff, not by direct inserts:

- Program memberships for 6 students (Naomi, Daniel, Leah, Ezra, Lena, Marcus). Maya stays pending without a program.
- One application created and submitted for Maya Bennett (Bachelor of Theology). The decisions queue shows 1 awaiting review.
- The Algebra II section (MATH-201-A) opened through the section status action, and Lena enrolled in it. Her portal shows 1 course and 1 schedule item.

This data is lost on the next reset.

## Defects found while preparing data

| Finding | Severity |
| --- | --- |
| The seeded draft application points to a legacy text program id (`prog-biblical-studies`), so submitting it fails with "Invalid identifier or value": the checklist snapshot expects a program UUID. Only legacy seed data has this shape. | S3 (seed data) |
| Validation failures in section enrollment ("No active period registration found…", "Course section is scheduled.") return **500 Unexpected API error** instead of a 4xx with the message. Staff see a generic failure for a fixable condition. | S2 |
| The student schedule shows "Aug 14, 8:00 PM" for a term starting Aug 15: a date-only value is read as UTC midnight and shown in local time, so it shifts a day back. | S2 |
| After a `supabase db reset`, `npm run db:migrate:local` re-runs old migrations and fails, because its tracking table is emptied and its bootstrap only recognizes tables up to July 2026. Workaround: copy `supabase_migrations.schema_migrations` into `public.schema_migrations`. | env tooling |

## Before the participant session

1. ~~Reset and reseed the local DB, then add programs, a registration, and one submitted application through the app~~ (done 2026-10-06).
2. ~~Re-run `npm run verify:pilot-readiness`~~ (passes after reset). Re-run `npm run verify:role-walkthrough`.
3. Confirm login from the participant's VM browser.
