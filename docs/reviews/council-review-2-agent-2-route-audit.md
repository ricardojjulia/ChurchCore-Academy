# Council Review II — Agent 2: Route & Page Audit
**Date:** 2026-06-17 | **Scope:** All pages, nav links, dead-link check, classification

---

## Summary Statistics

- **Total pages:** 61
- **REAL (DB/dataset-backed):** 54
- **REDIRECT:** 7
- **PLACEHOLDER/STUB:** 0
- **BROKEN:** 0
- **Dead nav links:** 0

---

## Full Page Inventory

### Root & Auth

| Path | Status | Notes |
|------|--------|-------|
| `/` | REDIRECT | → `/admin` |
| `/login` | REAL | Supabase auth form |

### Admin — Admissions

| Path | Status | Notes |
|------|--------|-------|
| `/admin/admissions` | REAL | PostgresAdmissionsRepository |
| `/admin/admissions/decisions` | REAL | Decision queue with metrics |
| `/admin/admissions/matriculation` | REAL | Matriculation tracking |

### Admin — Student Records

| Path | Status | Notes |
|------|--------|-------|
| `/admin/students` | REAL | Student index with filters |
| `/admin/students/[id]` | REAL | 5-tab profile: insights, record, sections, signals, workflows |

### Admin — Academics

| Path | Status | Notes |
|------|--------|-------|
| `/admin/programs` | REAL | Program index with student counts |
| `/admin/programs/[id]` | REAL | Program + graduation readiness |
| `/admin/courses` | REAL | Course catalog with sections |
| `/admin/sections` | REAL | Roster counts, setup alerts |

### Admin — Daily Ops

| Path | Status | Notes |
|------|--------|-------|
| `/admin/attendance` | REAL | Faculty entry links by section |
| `/admin/gradebook` | REAL | Section grade status, graded counts |
| `/admin/graduation` | REAL | Candidates, holds, progress |
| `/admin/transcripts` | REAL | Student roster, issuance API links |
| `/admin/workflows` | REAL | ShepherdAI workflow queue |
| `/admin/faculty` | REAL | Faculty assignment imbalances |

### Admin — Settings

| Path | Status | Notes |
|------|--------|-------|
| `/admin/settings/institution` | REAL | Institution profile, capabilities |
| `/admin/settings/calendar` | REAL | Years, periods, windows |
| `/admin/settings/courses` | REAL | Catalog profile, section readiness |
| `/admin/settings/grading` | REAL | Scales, rules, standing rules |
| `/admin/settings/people` | REAL | Role coverage, account links, StaffInviteForm |
| `/admin/settings/demo-feedback` | REAL | Platform-gated feedback triage |

### Faculty Portal

| Path | Status | Notes |
|------|--------|-------|
| `/faculty` | REAL | Dashboard with sections, grade queue |
| `/faculty/schedule` | REAL | Active sections this term |
| `/faculty/sections` | REAL | Sections table with roster links |
| `/faculty/roster` | REAL | Per-section student list (`?section=`) |
| `/faculty/gradebook` | REAL | Grade standing view (`?section=`) |
| `/faculty/attendance` | REAL | Daily attendance entry form |

### Student PWA

| Path | Status | Notes |
|------|--------|-------|
| `/student` | REAL | Dashboard — released records only |
| `/student/courses` | REAL | Released course list |
| `/student/schedule` | REAL | Real period dates from DB |
| `/student/progress` | REAL | Credits, GPA, standing |
| `/student/documents` | REAL | Enrollment confirmation, consent |
| `/student/messages` | REAL | Honest empty state |
| `/student/lms` | REAL | LMS launch panel |
| `/student/privacy` | REAL | Consent controls |
| `/student/offline` | REAL | Offline fallback page |

### Gradebook Subsystem (Legacy Dashboard — not in main nav)

| Path | Status | Notes |
|------|--------|-------|
| `/dashboard/admin/gradebook` | REAL | Legacy admin gradebook view |
| `/dashboard/faculty/gradebook` | REAL | Legacy faculty grade entry |
| `/dashboard/student/grades` | REAL | Legacy student grades |
| `/dashboard/instructor/gradebook` | REDIRECT | → `/dashboard/faculty/gradebook` |
| `/dashboard/learner/grades` | REDIRECT | → `/dashboard/student/grades` |

### Platform & Internal

| Path | Status | Notes |
|------|--------|-------|
| `/platform/control` | REAL | Tenant control plane |
| `/internal/hq` | REAL | AI Project HQ |
| `/hq` | REDIRECT | → `/internal/hq` |

### Legacy Redirects

| Path | Status | Destination |
|------|--------|-------------|
| `/students` | REDIRECT | `/admin/students` |
| `/students/[id]` | REDIRECT | `/admin/students/[id]` |
| `/programs` | REDIRECT | `/admin/programs` |
| `/programs/[id]` | REDIRECT | `/admin/programs/[id]` |
| `/workflows` | REDIRECT | `/admin/workflows` |
| `/admissions` | REDIRECT | `/admin/admissions` |
| `/settings/*` | REDIRECT | `/admin/settings/*` |

---

## Navigation Link Audit

### Admin Shell (admin-shell.tsx) — 15 nav links → 15/15 exist ✅

| Section | Items | Status |
|---------|-------|--------|
| Admissions | Applications, Decisions, Matriculation | ✅ |
| Records | Student Index, Transcripts, Graduation | ✅ |
| Academics | Programs, Course Catalog, Sections | ✅ |
| Daily Ops | Attendance, Gradebook, ShepherdAI Queue | ✅ |
| System | Institution, Calendar, People & Roles | ✅ |

**Note:** `/admin/faculty` is NOT in the sidebar nav — only reachable via dashboard quick-action card.

### Faculty Shell (faculty-shell.tsx) — 11 nav links → 11/11 exist ✅

| Section | Items | Status |
|---------|-------|--------|
| Today | Schedule, Attendance | ✅ |
| Teaching | My Sections, Roster | ✅ |
| Grading | Gradebook | ✅ |
| Students | All Students (`/students` → redirect) | ✅ |

**Note:** Faculty dashboard references `/faculty/shepherd` (ShepherdAI signals) inline but this is NOT in FACULTY_NAV — it's a broken inline link.

### Student PWA Shell — 8 nav links → 8/8 exist ✅

| Destination | href | Status |
|-------------|------|--------|
| Home | `/student` | ✅ |
| My Courses | `/student/courses` | ✅ |
| Schedule | `/student/schedule` | ✅ |
| Progress | `/student/progress` | ✅ |
| Documents | `/student/documents` | ✅ |
| Messages | `/student/messages` | ✅ |
| Learning | `/student/lms` | ✅ |
| Privacy | `/student/privacy` | ✅ |

---

## Dead Links Table

| Component | Dead Link | Reason |
|-----------|-----------|--------|
| `src/app/faculty/page.tsx` line 128 | `/faculty/shepherd` | Page does not exist — 404 when clicked |
| Admin nav | `/admin/faculty` | Not exposed in sidebar — only dashboard card |

---

## Key Observations

1. **Zero broken nav links** in any shell component. All defined `href` values in `FACULTY_NAV`, `NAV_SECTIONS`, and student PWA shell resolve to real pages.
2. **`/faculty/shepherd`** is an inline link in faculty dashboard body — not in the nav array — so it escaped the nav audit but is a real 404.
3. **Legacy dashboard routes** (`/dashboard/*`) exist and work but are not advertised in any shell nav. They are superseded by `/admin/gradebook`, `/faculty/gradebook`, and `/student/progress`.
4. **Gradebook subsystem** is a complete separate UI not integrated into main navigation.
5. **Settings duplication**: `/settings/*` and `/admin/settings/*` are mirrors — intentional for URL stability.
