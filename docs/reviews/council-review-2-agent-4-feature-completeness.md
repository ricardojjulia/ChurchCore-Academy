# Council Review II — Agent 4: Feature Completeness Evaluation
**Date:** 2026-06-17 | **Scope:** All product surfaces against the SIS product vision and factory roadmap

---

## Scoring Methodology

Each surface is rated on two axes:
- **Data fidelity:** real-DB vs stubbed/empty (0–5)
- **UX completeness:** all advertised workflows functional (0–5)

**Score = (data + ux) / 10**

---

## Surface-by-Surface Evaluation

### Admin Portal

| Surface | Data | UX | Score | Notes |
|---------|------|-----|-------|-------|
| Dashboard | 5 | 4 | 0.90 | Real data, ShepherdAI counts real. Missing: `/admin/faculty` link broken if user doesn't know about it |
| Admissions index | 5 | 4 | 0.90 | Application list, timeline, real data. Missing: approve/reject buttons — view only |
| Admissions decisions | 5 | 3 | 0.80 | Decision queue real. No approve/reject action UI |
| Admissions matriculation | 5 | 4 | 0.90 | Pending vs matriculated split correct |
| Student index | 5 | 4 | 0.90 | Filters work, search by name functional |
| Student profile | 5 | 5 | 1.00 | 5-tab profile complete — insights, record, sections, signals, workflows |
| Programs index | 5 | 4 | 0.90 | Real data, student counts. Missing: program edit form |
| Programs detail | 5 | 4 | 0.90 | Graduation readiness. Missing: course list edit |
| Course catalog | 5 | 4 | 0.90 | Real catalog. Missing: add/edit course form |
| Sections | 5 | 4 | 0.90 | Real roster counts, setup alerts. Missing: section edit form |
| Faculty page | 5 | 4 | 0.90 | Assignment imbalances. Missing: sidebar link |
| Gradebook | 5 | 4 | 0.90 | Real graded counts. Missing: grade entry (readonly view only) |
| Attendance | 5 | 4 | 0.90 | Section links to faculty form. Missing: summary per section |
| Transcripts | 5 | 4 | 0.90 | Issue links wired. Missing: download/PDF |
| Graduation | 5 | 4 | 0.90 | Candidate list, holds, progress real |
| ShepherdAI Workflows | 5 | 4 | 0.90 | Workflow queue real |
| Institution settings | 5 | 4 | 0.90 | Profile editable. Missing: save-confirmation UX |
| Calendar settings | 5 | 4 | 0.90 | Read only — no add term form |
| Courses settings | 5 | 3 | 0.80 | Readiness view only |
| Grading settings | 5 | 4 | 0.90 | Real scales. Missing: add band form |
| People settings | 5 | 4 | 0.90 | StaffInviteForm live. Missing: staff directory link |
| Demo feedback | 5 | 5 | 1.00 | Platform-gated, complete |
| **Staff directory** | **0** | **0** | **0.00** | **Does not exist** |
| **Reporting** | **0** | **0** | **0.00** | **Does not exist** |

### Faculty Portal

| Surface | Data | UX | Score | Notes |
|---------|------|-----|-------|-------|
| Dashboard | 5 | 3 | 0.80 | Real data. Broken `/faculty/shepherd` link |
| Schedule | 5 | 4 | 0.90 | Active sections listed |
| Sections | 5 | 4 | 0.90 | Roster links work |
| Roster | 5 | 4 | 0.90 | Student table real. Missing: attendance toggle inline |
| Gradebook | 5 | 4 | 0.90 | Grade standing view. Missing: grade entry form |
| Attendance | 5 | 4 | 0.90 | Entry form works. Missing: history view |
| **ShepherdAI Signals** | **0** | **0** | **0.00** | **404 — does not exist** |

### Student PWA

| Surface | Data | UX | Score | Notes |
|---------|------|-----|-------|-------|
| Dashboard | 5 | 4 | 0.90 | Released records, real progress items |
| My Courses | 5 | 4 | 0.90 | Real course list |
| Schedule | 5 | 4 | 0.90 | Real period dates from DB |
| Progress | 5 | 4 | 0.90 | Real credits, GPA |
| Documents | 5 | 3 | 0.80 | Links real. No actual PDF download |
| Messages | 3 | 3 | 0.60 | Honest empty state — no backend yet |
| LMS | 4 | 3 | 0.70 | Launch logic correct. Placeholder when no provider |
| Privacy | 5 | 4 | 0.90 | Consent toggles work |
| **Attendance view** | **0** | **0** | **0.00** | **No student attendance view** |

### Guardian Portal

| Surface | Data | UX | Score | Notes |
|---------|------|-----|-------|-------|
| **Guardian portal** | **0** | **0** | **0.00** | **Entire portal missing — `academy_student_relationships` populated but no UI** |

---

## Top 10 Gaps (Ranked by Impact)

| # | Gap | Impact | Prompt |
|---|-----|--------|--------|
| 1 | Guardian portal (`/guardian/*`) | HIGH — parents cannot access student progress | L |
| 2 | Staff directory (`/admin/staff`) | HIGH — no view of invited/active staff | H |
| 3 | `/faculty/shepherd` 404 | HIGH — faculty dashboard broken link | G |
| 4 | Reporting dashboard (`/admin/reporting`) | HIGH — no aggregate analytics | J |
| 5 | Student attendance view (`/student/attendance`) | MEDIUM — students can't see attendance record | I |
| 6 | Admin attendance summary per section | MEDIUM — section-level view needed | I |
| 7 | Role assignment form in people settings | MEDIUM — roles assigned via DB only | K |
| 8 | Program create/edit forms | MEDIUM — programs created via migration only | K |
| 9 | Admissions approve/reject action | MEDIUM — decision queue is read-only | Future |
| 10 | Grade entry form (faculty gradebook) | MEDIUM — faculty see grades but can't enter | Future |

---

## Implementation Prompts (G–L)

### Prompt G — Faculty ShepherdAI + Admin Nav Fixes
- Create `/faculty/shepherd` page showing ShepherdAI signals for faculty's assigned sections
- Add `/admin/faculty` to admin sidebar nav under "Daily Ops"
- Add `title={item.label}` tooltips to faculty shell leaf nav `<a>` tags

### Prompt H — Staff Directory
- Build `/admin/staff` page with real data from `academy_people` + `academy_staff_profiles`
- Add `DeactivateStaffButton` client component
- Link from `/admin/settings/people` and add to admin nav sidebar

### Prompt I — Attendance Surfaces
- Add `/student/attendance` PWA page reading from `academy_attendance_records`
- Enhance `/admin/attendance` to show per-section attendance summary table

### Prompt J — Reporting Dashboard
- Build `/admin/reporting` with enrollment counts, grade distribution, at-risk students, section fill rates
- Add to admin nav sidebar under "Reports"

### Prompt K — People & Program Admin Forms
- Add role assignment form to people settings
- New `POST /api/academy/people/role-assignments` route
- Program create form with title, code, required credits

### Prompt L — Guardian Portal
- Build `/guardian` layout and dashboard using `academy_student_relationships`
- Show linked student's progress: enrollment status, credits, GPA, next period
- SSO-gated — resolve guardian actor from session

---

## Overall SIS Completion Estimate

- **Pages with real data:** 54/61 (89%)
- **Workflows fully actionable:** ~70%
- **Key missing portals:** 2 (guardian, reporting)
- **Broken links:** 1 critical (`/faculty/shepherd`)
- **Staff management:** incomplete (invite exists, directory missing)
