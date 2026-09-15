# Story: Academic Calendar Admin CRUD
**ID:** T2-05
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Implemented in Sprint A / PR #61
**Date:** 2026-06-22

## User Story
As an institution admin, I want to create and edit academic years, terms, and sub-periods so the system accurately reflects my institution's calendar and can enforce enrollment windows, grade deadlines, and term-based billing.

## Background
Migrations exist for academic years, terms, periods, and subdivisions. The `/admin/settings/calendar` surface exists as a read-only review page. No admin CRUD forms exist. A new institution has no way to create their first academic year or term without direct database access.

## Acceptance Criteria
1. `/admin/settings/calendar` shows a structured view of academic years → terms → sub-periods.
2. Admin can create an academic year with: name, start date, end date.
3. Within an academic year, admin can create terms with: name, start date, end date, enrollment open/close dates, grade submission deadline.
4. Within a term, admin can create sub-periods (quarters, modules, intensives) with: name, start date, end date.
5. All entities can be edited (name, dates) until the start date passes.
6. Terms and years can be "closed" manually — closed terms lock grade entry and enrollment.
7. Active (current) term is auto-derived as the term whose date range includes today; displayed prominently on the calendar page.
8. Admin can set enrollment window per term: registration opens/closes dates control student self-registration and section availability.

## Edge Cases
- Term dates outside the parent academic year: blocked with "Term dates must fall within the academic year."
- Sub-period dates outside the parent term: blocked similarly.
- Overlapping term date ranges within the same year: warning shown, not blocked (some institutions run concurrent terms).
- Editing term dates after enrollment has started: allowed with confirmation dialog "Changing term dates after enrollment is open may affect registered students."
- Deleting a term with registered students: blocked.
- Creating an academic year that overlaps an existing year: warning shown.

## Out of Scope
- Holiday and blackout date management (Tier 4)
- Automatic term rollover / year creation (Tier 4)
- Multi-campus calendar differentiation

## Role Matrix
| Role | Create Year | Create Term | Create Sub-Period | Edit | Close | View |
|------|:-----------:|:-----------:|:-----------------:|:----:|:-----:|:----:|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Registrar | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Faculty | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Student | ✗ | ✗ | ✗ | ✗ | ✗ | Current term |

## Technical Notes
- Module: `src/modules/academic-calendar/` — extend with `createAcademicYear`, `createTerm`, `updateTerm`, `closeTerm`
- API routes: `POST /api/academy/calendar/years`, `POST /api/academy/calendar/terms`, `PATCH /api/academy/calendar/terms/[id]`
- Page: `src/app/admin/settings/calendar/page.tsx`
- Active term derivation: `WHERE start_date <= NOW() AND end_date >= NOW() AND status = 'active'`
- Enrollment window enforcement: check `enrollment_open_at` and `enrollment_close_at` in the registration service (T2-09)

## Tests Required
- `createAcademicYear()` success: year created with valid dates.
- `createTerm()` success: term created within year, enrollment window set.
- `createTerm()` out-of-range dates: term dates outside year → validation error.
- `updateTerm()` success: name and dates updated.
- `closeTerm()` success: term status set to `closed`, grade entry locked.
- `deleteTerm()` with enrollments: blocked.
- `getActiveTerm()`: returns term whose range includes today.
- Cross-tenant rejection: admin on tenant A cannot modify terms on tenant B.
