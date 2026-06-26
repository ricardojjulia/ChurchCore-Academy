# Story: Guardian Scoped Access
**ID:** T3-03
**Tier:** 3 — Achieve Competitive Differentiation
**Status:** Implemented in Sprint C / PR #63
**Date:** 2026-06-22

## User Story
As a guardian, I want to see my student's attendance record, current posted grades, and account balance from a dedicated portal so I can stay informed about their progress without calling the institution.

As an institution admin, I want to control exactly which data categories guardians can access and enforce FERPA restrictions when a student revokes guardian access so I remain compliant with privacy regulations.

## Background
`academy_student_relationships` exists with guardian link data. The `/guardian` page shows linked students but renders whatever the admin student profile shows — there is no scoping. Guardians see staff notes, advisor information, and admin-only fields that should be private. FERPA requires institutions to control parent access for students 18+.

## Acceptance Criteria
1. Guardian login shows only their linked student(s) — no other student records accessible.
2. **Attendance:** Guardian sees per-section attendance summary (present/absent/late counts per section, recent absence dates). No individual teacher notes visible.
3. **Grades:** Guardian sees current-term posted (official) grades only. Draft grades not visible. Prior-term grades visible as GPA only (not individual course breakdown unless institution enables).
4. **Balance:** Guardian sees student's current billing balance (amount due). No itemized ledger entries.
5. **ShepherdAI signals:** NOT visible to guardians.
6. **Advisor notes:** NOT visible to guardians.
7. **FERPA revocation:** Admin can mark a student relationship as `ferpa_restricted`. Once set, guardian login shows "Access to this student's records has been restricted" and no data is returned.
8. Guardian cannot navigate to any `/admin/` route — 403 if attempted directly.

## Edge Cases
- Guardian linked to two students at different institutions (different tenants): each login only shows students for the tenant they authenticated with.
- Student turns 18 and admin sets FERPA restriction: guardian access to that student is revoked immediately on next page load.
- Guardian tries to access `/admin/students/[id]` directly: 403.
- Institution disables guardian portal entirely: all `/guardian` routes redirect to a "Guardian access is not enabled for this institution" page.
- Guardian account (email) shared by two parents: both parents see the same data (no differentiation in v1).

## Out of Scope
- Guardian messaging / inbox (Tier 4)
- Guardian consent management forms (Tier 4)
- Guardian-initiated communication with faculty (Tier 4)
- FERPA consent tracking audit trail (Tier 4)

## Role Matrix
| Role | View Attendance | View Posted Grades | View Balance | View Advisor Notes | View ShepherdAI |
|------|:--------------:|:-----------------:|:------------:|:-----------------:|:---------------:|
| Guardian (active) | Own student | Own student / posted | Own student | ✗ | ✗ |
| Guardian (FERPA restricted) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |

## Technical Notes
- Auth boundary: guardian portal uses the same Supabase session auth. Role resolution must return `guardian` role when the logged-in user's person ID is linked via `academy_student_relationships`.
- Scoped data functions: `fetchGuardianStudentSummary(guardianPersonId, studentPersonId, client)` — validates relationship before reading any data
- FERPA flag: add `ferpa_restricted boolean default false` to `academy_student_relationships` or to a new `academy_ferpa_restrictions` table
- Pages: `src/app/guardian/page.tsx` and `src/app/guardian/[studentId]/page.tsx` — enforce scoped reads, remove any admin-data leakage
- ADR reference: ADR-0009 (guardian relationship scoped access model) — this story implements it

## Tests Required
- `fetchGuardianStudentSummary()` success: returns attendance, posted grades, balance for linked student.
- `fetchGuardianStudentSummary()` unlinked student: guardian cannot fetch data for a student they are not linked to.
- `fetchGuardianStudentSummary()` FERPA restricted: returns null data (not an error; renders access-revoked message).
- Guardian cannot access advisor notes: notes field absent from guardian response shape.
- Guardian cannot access ShepherdAI suggestions: suggestions field absent.
- Cross-tenant rejection: guardian cannot access student data across tenant boundaries.
- `/admin/` route guard: guardian session attempting `/admin/students/[id]` returns 403.
