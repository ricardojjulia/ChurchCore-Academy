# Council Review II — Synthesis & Implementation Plan
**Date:** 2026-06-17 | **Agents:** 4 parallel | **Scope:** Post Prompts A–F SIS state

---

## Council Participants

| Agent | Role | Report |
|-------|------|--------|
| Agent 1 | Full SIS state audit (migrations, modules, routes) | `council-review-2-agent-1-sis-state-audit.md` |
| Agent 2 | Route & page audit (nav links, dead-link check) | `council-review-2-agent-2-route-audit.md` |
| Agent 3 | UX / shell audit (ARIA, CSS, nav states) | `council-review-2-agent-3-ux-shell-audit.md` |
| Agent 4 | Feature completeness evaluation (gap analysis) | `council-review-2-agent-4-feature-completeness.md` |

---

## Cross-Agent Consensus Findings

### ✅ What's Working Well
1. **All 54 real pages load from real DB.** No mock-data leakage into production surfaces.
2. **All shell nav links resolve.** Zero broken hrefs in `FACULTY_NAV`, `NAV_SECTIONS`, student PWA shell.
3. **Student PWA data fidelity achieved.** Schedule dates, credits, GPA all come from `academy_academic_periods` + student records.
4. **Staff invite end-to-end complete.** POST route + client form + DB write.
5. **Registration withdraw end-to-end complete.** PATCH route + client button + DB update.
6. **570 tests, zero failures.** All node:test suites pass.
7. **aria-expanded now boolean.** ARIA regression fixed in Prompt C.

### ⛔ Critical Issues (All Agents Agree)
1. **`/faculty/shepherd` is a 404.** Faculty dashboard has a working link to a non-existent page. Every faculty member who clicks it hits a Next.js 404.
2. **Guardian portal is entirely absent.** `academy_student_relationships` is seeded. The DB is ready. But there is zero UI for guardians.
3. **Staff directory does not exist.** Staff can be invited but there is no directory view. `/admin/settings/people` shows invite form only.

### ⚠️ HIGH Priority Gaps
- `/admin/faculty` not in sidebar nav (reachable only via dashboard card)
- `/admin/reporting` — no aggregate reporting surface
- `/student/attendance` — student has no view of their own attendance record
- Role assignment form — roles are DB-only, no UI to assign

---

## Implementation Prompts (Execution Order)

### Prompt G — Faculty ShepherdAI + Admin Nav Fixes
**Files:** `src/app/faculty/shepherd/page.tsx`, `src/components/admin-shell.tsx`, `src/components/faculty-shell.tsx`
**Work:**
1. Create `/faculty/shepherd` server component — load `loadProtectedAcademyDataset()`, filter `dataset.signals` to sections where `instructorFacultyId` matches actor's faculty ID, display in signal cards
2. Add `{ label: "Faculty", href: "/admin/faculty" }` to Daily Ops section in `NAV_SECTIONS`
3. Add `title={item.label}` to faculty shell leaf `<a>` tags

### Prompt H — Staff Directory
**Files:** `src/app/admin/staff/page.tsx`, `src/components/deactivate-staff-button.tsx`, `src/components/admin-shell.tsx`, `src/app/admin/settings/people/page.tsx`
**Work:**
1. Build `/admin/staff` using `withAcademyDatabaseContext` — join `academy_people + academy_staff_profiles`
2. Display table: name, email, primaryRole, employmentStatus, hire date
3. Add `DeactivateStaffButton` — PATCH to `/api/academy/staff/[id]` with `{ employmentStatus: "inactive" }`
4. Add "Staff Directory" link to admin nav under Daily Ops
5. Add "View all staff →" link from people settings page

### Prompt I — Attendance Surfaces
**Files:** `src/app/student/attendance/page.tsx`, `src/app/admin/attendance/page.tsx`
**Work:**
1. Build `/student/attendance` — load `loadStudentPwaPageModel()`, query `academy_attendance_records` for student's person ID, show per-section attendance list with status badges
2. Enhance `/admin/attendance` — add per-section summary table: section code, present count, absent count, late count from `academy_attendance_records`

### Prompt J — Reporting Dashboard
**Files:** `src/app/admin/reporting/page.tsx`, `src/components/admin-shell.tsx`
**Work:**
1. Build `/admin/reporting` — load `loadProtectedAcademyDataset()`, compute metrics inline:
   - Enrollment by status (active, pending, admitted, application_started)
   - Section fill rate (rosterCount / rosterCapacity per section)
   - At-risk students (statusFlag = "academic_probation" or signals with urgency critical/high)
   - Grade distribution (query `academy_gradebook_course_summaries`)
2. Add "Reporting" to admin nav under a new "Reports" section

### Prompt K — People & Program Admin Forms
**Files:** `src/app/admin/settings/people/page.tsx`, `src/app/api/academy/people/role-assignments/route.ts`, `src/app/admin/programs/new/page.tsx`, `src/app/api/academy/programs/route.ts`
**Work:**
1. Add role assignment form to people settings: select person + role → POST `/api/academy/people/role-assignments`
2. Build `POST /api/academy/people/role-assignments` — inserts into `academy_person_role_assignments`
3. Build `/admin/programs/new` create form with title, code, required credits, description
4. Add POST handler to `/api/academy/programs` to insert new program

### Prompt L — Guardian Portal
**Files:** `src/app/guardian/layout.tsx`, `src/app/guardian/page.tsx`, `src/app/guardian/[studentId]/page.tsx`
**Work:**
1. Create guardian layout with auth check — resolve actor from session, assert `primaryRole === "guardian"`
2. Dashboard: query `academy_student_relationships` for guardian's person ID, list linked students
3. Per-student view: enrollment status, credits, GPA, next period, documents

---

## Execution Order & Gates

```
Prompt G → npm test && lint && build
Prompt H → npm test && lint && build
Prompt I → npm test && lint && build
Prompt J → npm test && lint && build
Prompt K → npm test && lint && build
Prompt L → npm test && lint && build
```

All prompts are independent of each other's DB schema (no new migrations needed). They share only the existing `academy_*` tables. Execute sequentially.
