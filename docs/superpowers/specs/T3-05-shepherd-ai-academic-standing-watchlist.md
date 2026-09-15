# Story: ShepherdAI Academic Standing Watchlist
**ID:** T3-05
**Tier:** 3 — Achieve Competitive Differentiation
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story
As a registrar or academic dean, I want a consolidated watchlist view of all students currently flagged by any ShepherdAI signal so I can prioritize my advising outreach and see the full risk picture at a glance — without checking each student record individually.

## Background
ShepherdAI generates individual suggestions per student but they are scattered across the workflow queue mixed with faculty and documentation signals. There is no consolidated "at-risk student" view. A registrar handling 200 students has no way to see which 12 students need urgent outreach today without clicking through every suggestion individually.

## Acceptance Criteria
1. A "Watchlist" view is accessible from the admin workflows page or as a direct nav item.
2. Watchlist shows every student who has at least one open ShepherdAI suggestion.
3. Columns: student name (link to profile), program, enrollment status, cumulative GPA, active signal types (as badges), highest urgency level, and number of open signals.
4. Default sort: highest urgency first, then by number of signals descending.
5. Filters: by signal type, by urgency level, by program, by enrollment status.
6. Each row links to the student profile and to the filtered workflow queue for that student.
7. "Export CSV" action exports the watchlist with all columns.
8. Students with resolved or dismissed signals are not shown (only open signals count).

## Edge Cases
- Student with 5 open signals across 3 categories: appears once in watchlist with all signal badges shown.
- Student whose last signal is resolved: removed from watchlist immediately.
- Large institution with 500 flagged students: pagination with 50 per page; CSV export is full list.
- Registrar filters by "graduation_readiness" signal: watchlist narrows to only those students.
- Student profile link opens in same tab (not new tab) — uses existing student context system.

## Out of Scope
- Automated outreach / email from watchlist (Tier 3/T3-07 PWA self-service)
- Cohort-level risk scoring (Tier 4)
- Historical watchlist snapshots (Tier 4)
- Predictive risk modeling (outside ADR-0022 boundary)

## Role Matrix
| Role | View Watchlist | Export CSV | Act on Signals |
|------|:--------------:|:----------:|:--------------:|
| Admin | ✓ (all students) | ✓ | ✓ |
| Registrar | ✓ (all students) | ✓ | ✓ |
| Advisor | ✓ (their advisees only) | ✓ (their advisees) | ✓ |
| Faculty | ✓ (their section students) | ✗ | ✗ |
| Student | ✗ | ✗ | ✗ |

## Technical Notes
- Data source: join `academy_shepherd_ai_suggestions` (open) with `academy_student_profiles` and `academy_shepherd_ai_workflow_actions`
- Requires T1-01 (ShepherdAI persistence) to be complete — watchlist is meaningless if actions don't persist
- Page: extend `src/app/admin/workflows/page.tsx` with a "Watchlist" tab or create `src/app/admin/workflows/watchlist/page.tsx`
- CSV export: reuse the reporting infrastructure from `src/app/api/academy/reports/`
- Advisor scoping: filter students where the logged-in person is linked as advisor via `academy_student_relationships` or a new `academy_student_advisors` table

## Tests Required
- `fetchWatchlist()` success: returns students with open signals, sorted by urgency.
- `fetchWatchlist()` resolved signal excluded: student with only resolved signals not in result.
- `fetchWatchlist()` advisor scope: advisor only sees their advisees.
- `fetchWatchlist()` filter by signal type: returns only students with that signal type active.
- `fetchWatchlist()` empty: returns empty array (not an error).
- CSV export: all columns present; no advisor notes or internal fields in export.
- Cross-tenant rejection: registrar cannot see watchlist across tenant boundaries.
