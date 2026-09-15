# Council Review VI — Agent 1: SIS State Audit

_Date: 2026-06-18_

## 1. Migrations — 57 tables, all with RLS

All tables have RLS enabled. No unprotected table found.

**Flag — UUID/text type mismatch (active blocker):**
`academy_attendance_records.course_section_id` and `student_person_id` are `uuid` — but `academy_course_sections.id` and `academy_people.id` are `text`. Same mismatch in `academy_transcript_issuances` (`student_person_id`, `issued_by_person_id`). The seed file `20260618030000` calls this out explicitly as a blocker. Queries joining these columns will fail silently or error in production.

**Flag — Legacy stub tables:**
`academy_admin_users`, `academy_programs`, `academy_students`, `academy_faculty`, `academy_sections`, `academy_thresholds` from `20260424010000`. No normalized module types. Referenced by `loadProtectedAcademyDataset`.

## 2. Modules

| Module | types.ts | Repository | __tests__ | Notes |
|---|---|---|---|---|
| `academic-calendar` | Y | postgres-repository | Y | |
| `academic-programs` | Y | postgres-repository | Y | |
| `academic-workflows` | Y | repository (in-memory) | Y | No postgres-repository |
| `academy-auth` | — | postgres-identity-repository | Y | Auth infra only |
| `academy-config` | Y | postgres-repository | Y | |
| `academy-data` | Y | postgres-repository | Y | **Mock-data bridge — must not import in runtime pages** |
| `admissions` | Y | postgres-repository | Y | |
| `attendance` | Y | postgres-repository | Y | Blocked by uuid/text mismatch |
| `audit` | Y | postgres-repository | Y | |
| `course-catalog` | Y | postgres-repository | Y | |
| `course-registration` | Y | postgres-repository | Y | |
| `demo-feedback` | Y | postgres-repository | Y | |
| `enrollment-conversion` | Y | postgres-repository | Y | |
| `gradebook` | Y | postgres-repository | Y | |
| `grading-records` | Y | postgres-repository | Y | |
| `learner-intelligence` | Y | postgres-repository | Y | |
| `lms-contract` | — | adapter/interface only | Y | |
| `people` | Y | postgres-repository | Y | |
| `platform-admin` | Y | postgres-repository | Y | |
| `scheduled-jobs` | Y | evaluate-academic-workflows | Y | |
| `shepherd-ai` | Y | postgres-repository | Y | |
| `student-pwa` | — | server-read-model | Y | |
| `transcripts` | Y | postgres-repository | Y | Blocked by uuid/text mismatch |

**Gaps:** `academy-auth`, `lms-contract`, `student-pwa` missing types.ts.

## 3. API Routes

50 routes. Notable gaps: no course-catalog CRUD (courses/sections create/update/delete), no academic-calendar CRUD (years/periods), no gradebook assignment or scale management endpoints.

## 4. App Pages — 65 pages

**33 pages still import `loadProtectedAcademyDataset`** — all faculty pages, 12 admin pages, guardian pages, student attendance. Any live tenant that is not `cca-main` will see empty or broken pages. Unresolved from Council V.

## 5. Seed Data

6 seed files. Realistic for demo. Missing: no `academy_attendance_records` or `academy_transcript_issuances` rows (blocked by uuid/text mismatch), no staff profiles, no historical academic year data.

## 6. Top 5 Critical Missing Pieces for MVP

1. **UUID/text type mismatch** — attendance and transcript tables cannot be used until columns are corrected to `text`. Most structurally dangerous active issue.
2. **33 pages on mock-data bridge** — any second tenant sees broken pages; must migrate to real queries before MVP.
3. **No course catalog or calendar management API** — read-only admin settings only; cannot configure a real institution.
4. **Gradebook missing assignment management endpoints** — faculty cannot build a real gradebook.
5. **No graduation audit module** — graduation page uses mock data; no real computation against enrollment records.
