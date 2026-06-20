# Council Review V — Agent 1: SIS State Audit

_Date: 2026-06-18_

## 1. Migrations — 46 tables, all with RLS

All 46 tables have RLS enabled. No table without RLS found.

**Flag — Legacy stub tables still present:**
`academy_admin_users`, `academy_programs`, `academy_students`, `academy_faculty`, `academy_sections`, `academy_thresholds` — from the ShepherdAI-era migration `20260424010000`. These have RLS but no dedicated module types. They are consumed only by `academy-data/mock-data.ts` and the ShepherdAI scorer. Normalized replacements exist but old tables remain in the read path.

**Flag — HQ tables without a module:**
`hq_sessions`, `hq_tasks`, `hq_risks`, `hq_decisions` — no module directory owns these.

## 2. Modules

| Module | types.ts | Repository | __tests__ | API route |
|---|---|---|---|---|
| `academy-auth` | No | `postgres-identity-repository.ts` | Yes | Implicit |
| `academy-config` | Yes | `postgres-repository.ts` | Yes | `/api/academy/config/institution` |
| `academic-calendar` | Yes | `postgres-repository.ts` | Yes | `/api/academy/config/calendar` |
| `academic-programs` | Yes | `postgres-repository.ts` | Yes | `/api/academy/programs` |
| `academic-workflows` | **Missing** | `repository.ts` | **Missing** | `/api/academy/workflows` |
| `academy-data` | Yes | `postgres-repository.ts` | Yes | Internal only |
| `admissions` | Yes | `postgres-repository.ts` | Yes | `/api/academy/admissions` |
| `attendance` | Yes | `postgres-repository.ts` | Yes | `/api/academy/attendance` |
| `audit` | Yes | `postgres-repository.ts` | Yes | Not directly wired |
| `course-catalog` | Yes | `postgres-repository.ts` | Yes | `/api/academy/config/courses` |
| `course-registration` | Yes | `postgres-repository.ts` | Yes | `/api/academy/registrations` |
| `demo-feedback` | Yes | `postgres-repository.ts` | Yes | `/api/academy/demo-feedback` |
| `enrollment-conversion` | Yes | `postgres-repository.ts` | Yes | `/api/academy/admissions/applications/[id]/convert` |
| `gradebook` | Yes | `postgres-repository.ts` | Yes | `/api/academy/gradebook/records` |
| `grading-records` | Yes | `postgres-repository.ts` | Yes | `/api/academy/config/grading` |
| `learner-intelligence` | Yes | `postgres-repository.ts` | Yes | `/api/academy/learner-intelligence/*` |
| `lms-contract` | **Missing** | Contract + adapters | Yes | `/api/academy/lms/contract` |
| `people` | Yes | `postgres-repository.ts` | Yes | `/api/academy/students`, `/api/academy/staff` |
| `platform-admin` | Yes | `postgres-repository.ts` | Yes | `/api/platform/tenants` |
| `scheduled-jobs` | **Missing** | `evaluate-academic-workflows.ts` | **Missing** | None — invoked from admin page |
| `shepherd-ai` | Yes | `postgres-repository.ts` | Yes | `/api/academy/shepherd-ai` |
| `student-pwa` | **Missing** | `server-read-model.ts` | Yes | `/api/academy/student/lms/launch` |
| `transcripts` | Yes | `postgres-repository.ts` | Yes | `/api/academy/transcripts` |

**Gaps:** `academic-workflows` (no types.ts, no __tests__), `scheduled-jobs` (no types, no tests, called directly from server component), `student-pwa` and `lms-contract` (no types.ts).

## 3. API Routes (50 routes total)

All standard routes present. Notable: `/api/ai` (POST) is a raw AI proxy with no module backing — not tied to ShepherdAI module.

## 4. App Pages

Redirect stubs are intentional legacy aliases (/, /admissions, /students, /workflows, /programs, /hq, /settings/*, /dashboard/*/). No genuinely empty stubs found. All content pages render real content.

## 5. Seed Data

Present: institution profile, academic year, personas (student/faculty/admin/guardian/applicant), programs, courses, sections, admissions chain → enrollment → registrations for 3 students, gradebook records, ShepherdAI signals + suggestions.

**Missing:**
- Attendance records (table seeded, zero rows)
- Transcript issuances for demo personas
- Guardian relationship rows (`academy_student_relationships`)
- Grading windows and evaluation scales (grading config screen shows empty defaults)

## 6. Top 5 Critical Missing Pieces for MVP

1. **Legacy stub tables in the read path** — `academy-data/server-dataset.ts` reads the ShepherdAI-era stubs, not normalized tables. Until rebuilt, the SIS operates on seeded mock rows, not real enrollment state. This is the single biggest architectural debt.

2. **No enrollment-to-active-student bridge in the UI** — The `/convert` API exists but no admin UI form triggers it. Admissions decisioning has no forward path to live student records.

3. **Gradebook assignment CRUD missing** — Faculty can submit grades via `POST /api/academy/gradebook/records` but cannot create or manage assignments. No assignment management surface exists.

4. **`student/messages` and `student/documents` are unimplemented stubs** — No DB tables back these student PWA routes. Students see empty panels with no resolution path.

5. **`scheduled-jobs` called from server component** — `evaluate-academic-workflows.ts` runs synchronously on every workflows page render. Violates thin-route rule, no types, no tests. Must move to an explicit API call or cron.
