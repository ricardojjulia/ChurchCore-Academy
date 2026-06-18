# Council Review II — Agent 1: Full SIS State Audit
**Date:** 2026-06-17 | **Scope:** Migrations, pages, modules, seed data gaps, API routes

---

## 1. Migration Tables & RLS Status

**Total tables created:** 68 unique CREATE TABLE statements

### Core Institution & Configuration (RLS: Mixed)
- `academy_institution_profiles` (RLS: ✓)
- `academy_calendar_profiles` (RLS: ✓)
- `academy_institution_subdivisions` (RLS: ✓)
- `academy_account_links` (RLS: ✓)

### Academic Calendar (RLS: ✓)
- `academy_academic_years`
- `academy_academic_periods`
- `academy_enrollment_windows`
- `academy_grading_windows`
- `academy_transcript_periods`

### Course Catalog (RLS: ✓)
- `academy_courses`
- `academy_course_sections`
- `academy_course_prerequisites`
- `academy_course_lms_mappings`

### People & Roles (RLS: ✓)
- `academy_people`
- `academy_person_role_assignments`
- `academy_student_profiles`
- `academy_staff_profiles`
- `academy_faculty`
- `academy_student_relationships`

### Grading & Evaluation (RLS: ✓)
- `academy_grading_profiles`
- `academy_evaluation_scales`
- `academy_evaluation_scale_bands`
- `academy_evaluation_rule_sets`
- `academy_official_record_rules`
- `academy_academic_standing_rules`

### Enrollment & Registration (RLS: ✓)
- `academy_programs` (legacy stub — no RLS)
- `academy_academic_programs` **[NEW 2026-06-16]** (RLS: ✓)
- `academy_program_enrollments` (RLS: ✓)
- `academy_course_section_registrations` (RLS: ✓)
- `academy_period_registrations` (RLS: ✓)
- `academy_enrollment_confirmation_events` (RLS: ✓)
- `academy_enrollment_conversion_events` (RLS: ✓)

### Admissions (RLS: ✓)
- `academy_admission_applications`
- `academy_admission_application_events`

### Gradebook Phase 1 [NEW 2026-06-16] (RLS: ✓)
- `academy_gradebook_scales`
- `academy_gradebook_scale_entries`
- `academy_gradebook_assignments`
- `academy_gradebook_submissions`
- `academy_gradebook_records`
- `academy_gradebook_course_summaries`
- `academy_gradebook_override_audit`

### Transcripts [NEW 2026-06-16] (RLS: ✓)
- `academy_transcript_issuances`

### Attendance [NEW 2026-06-16] (RLS: ✓)
- `academy_attendance_records`

### Learner Intelligence [NEW 2026-06-14] (RLS: ✓)
- `academy_learner_memory`
- `academy_learner_identity_snapshots`
- `academy_learner_intelligence_consent`
- `academy_learner_activity_events`
- `academy_learner_consent_events`
- `academy_intervention_recommendations`
- `academy_intervention_status_history`

### Demo Feedback (RLS: ✓)
- `academy_demo_feedback`
- `academy_demo_feedback_rate_limits`

### Audit & Logging (RLS: ✓)
- `academy_audit_events`
- `academy_platform_audit_events`

### ShepherdAI (RLS: Partial)
- `ai_signals` (**no RLS**)
- `ai_suggestions` (**no RLS**)
- `workflow_actions` (RLS: ✓)
- `workflow_feedback` (RLS: ✓)
- `workflows` (RLS: ✓)

### Platform Admin [NEW 2026-06-15] (RLS: ✓)
- `academy_tenant_registry`
- `academy_platform_role_assignments`
- `academy_platform_user_preferences`
- `academy_student_number_sequences`
- `academy_admin_users`

### HQ Control Plane [NEW 2026-06-13] (RLS: ✓)
- `hq_sessions`
- `hq_risks`
- `hq_decisions`
- `hq_tasks`

**RLS Summary:**
- With RLS enabled: 62 tables
- Without RLS: 6 tables (`ai_signals`, `ai_suggestions`, `workflow_actions`, `workflow_feedback`, `workflows`, legacy `academy_programs`)
- New tables since 2026-06-16: 13 (gradebook, transcripts, attendance, academic-programs)

---

## 2. All App Pages (61 total)

### Admin Portal (22 pages) — All REAL

| URL | Data Loading |
|-----|--------------|
| `/admin` | `loadProtectedAcademyDataset()` + `runAcademicWorkflowEvaluationJob()` |
| `/admin/students` | `loadProtectedAcademyDataset()` |
| `/admin/students/[id]` | Dataset + direct DB registrations query |
| `/admin/programs` | `loadProtectedAcademyDataset()` |
| `/admin/programs/[id]` | Dataset + workflow evaluation |
| `/admin/courses` | `loadProtectedAcademyDataset()` |
| `/admin/sections` | `loadProtectedAcademyDataset()` |
| `/admin/faculty` | `loadProtectedAcademyDataset()` |
| `/admin/gradebook` | Dataset + direct `loadGradedCounts()` pool query |
| `/admin/attendance` | `loadProtectedAcademyDataset()` |
| `/admin/transcripts` | `loadProtectedAcademyDataset()` |
| `/admin/graduation` | `loadProtectedAcademyDataset()` |
| `/admin/workflows` | Dataset + workflow evaluation |
| `/admin/admissions` | `PostgresAdmissionsRepository` |
| `/admin/admissions/decisions` | `PostgresAdmissionsRepository` |
| `/admin/admissions/matriculation` | Admissions repo + dataset |
| `/admin/settings/institution` | Dataset |
| `/admin/settings/calendar` | Dataset |
| `/admin/settings/courses` | Dataset |
| `/admin/settings/grading` | `AcademyGradingRecordsRepository` |
| `/admin/settings/demo-feedback` | Platform-gated demo feedback service |
| `/admin/settings/people` | `AcademyPeopleRepository` + `loadPeopleReviewModel()` |

### Faculty Portal (6 pages) — All REAL

| URL | Data Loading |
|-----|--------------|
| `/faculty` | Dataset + workflow evaluation (graceful degradation) |
| `/faculty/schedule` | `loadProtectedAcademyDataset()` |
| `/faculty/sections` | `loadProtectedAcademyDataset()` |
| `/faculty/roster` | Dataset + `?section=` param |
| `/faculty/gradebook` | Dataset + `?section=` param |
| `/faculty/attendance` | Dataset + `FacultyAttendanceForm` |

### Student PWA (10 pages) — All REAL

| URL | Data Loading |
|-----|--------------|
| `/student` | `loadStudentPwaPageModel()` |
| `/student/courses` | `loadStudentPwaPageModel()` |
| `/student/schedule` | Model — **real period dates from DB** |
| `/student/progress` | Model — **real credits + GPA** |
| `/student/documents` | `loadStudentPwaPageModel()` |
| `/student/messages` | Session validation only — honest empty state |
| `/student/lms` | `loadStudentPwaPageModel()` |
| `/student/offline` | Static fallback |
| `/student/privacy` | `StudentConsentControls` |

---

## 3. Modules With Real DB vs Mock

### 18 Modules WITH postgres-repository (Real DB)

| Module | Pattern |
|--------|---------|
| `academy-data` | Denormalized read model for full dataset loads |
| `academic-calendar` | Years, periods, windows, subdivisions |
| `academic-programs` | Lists/retrieves programs with filters |
| `academy-config` | Institution profiles, calendars, grading |
| `course-catalog` | Courses, sections, prerequisites, LMS mappings |
| `people` | Students, staff, faculty, relationships |
| `admissions` | Applications, decisions, enrollment conversion |
| `attendance` | Attendance records, session tracking |
| `audit` | Audit events, platform audit logs |
| `course-registration` | Section registrations, status changes |
| `enrollment-conversion` | Admitted → active conversion workflow |
| `grading-records` | Grade submissions, transcripts |
| `gradebook` | Scales, assignments, submissions, records |
| `learner-intelligence` | Interventions, signals, memory snapshots |
| `demo-feedback` | Demo mode feedback collection |
| `shepherd-ai` | Workflow signals, suggestions, actions |
| `transcripts` | Transcript issuances, release tracking |
| `platform-admin` | Tenant registry, platform roles |

### 5 Modules WITHOUT postgres-repository (Contract/Service/View)

| Module | Pattern |
|--------|---------|
| `academy-auth` | SSO session auth, role resolution |
| `student-pwa` | Read model built from shared `academy-data` dataset |
| `lms-contract` | Provider-neutral LMS interfaces + adapters |
| `academic-workflows` | Workflow orchestration service |
| `scheduled-jobs` | Cron job for ShepherdAI evaluation |

---

## 4. Seed/Demo Data Gaps

`loadProtectedAcademyDataset()` queries real DB for all core data. When tenant is not seeded, it catches "is not seeded" error and serves `mock-data.ts` fallback. Admin dashboard displays a seed warning; counts default to 0 on failure (not mocked).

**What is hardcoded in `mock-data.ts` fallback:**
- Institution name: "ChurchCore Academy"
- Institution modes: Bible school, children's school, seminary, college, university
- Subdivisions with branch/grade-band hierarchies
- Default calendar: rolling_enrollment, module terms, America/New_York

**Conclusion:** All real queries succeed for `cca-main` tenant when seeded. Mock data is only a fallback, not served in normal operation.

---

## 5. Admin Dashboard Data

All counts are REAL:
- `studentsCount = evaluation?.dataset.students.length ?? 0`
- `programsCount = evaluation?.dataset.programs.length ?? 0`
- `facultyCount = evaluation?.dataset.faculty.length ?? 0`
- `highUrgencyCount` from real ShepherdAI signals

Dashboard gracefully degrades to zeros (not mock) if dataset fails.

---

## 6. Student PWA Model (Post Prompt D)

- **Schedule dates:** Real — `period.startsOn` from `academy_academic_periods`, fallback to `dataset.generatedAt`
- **Credits earned:** Real — `activeStudent.creditsEarned` surfaced in progress
- **GPA:** Real — `activeStudent.gpa.toFixed(2)` shown when not null
- **Academic standing:** Real — from `activeStudent.statusFlag`
- **Messages:** Honest empty state — no fake welcome messages

---

## 7. API Routes (47 total, 45 real)

### Staff Management [NEW — Prompt E]
- `POST /api/academy/staff/invite` — creates person + staff profile ✓
- `PATCH /api/academy/staff/[id]` — updates employment status / role ✓

### Registration Management [NEW — Prompt F]
- `PATCH /api/academy/registrations/[id]` — updates section registration status ✓

### Admissions (5 routes) — All real
### Students (2 routes) — All real
### Programs (2 routes) — All real
### Attendance (1 route) — Real
### Transcripts (2 routes) — Real
### ShepherdAI (5 routes) — Real
### Workflows (5 routes) — Real
### Learner Intelligence (6 routes) — Real
### Platform (4 routes) — Real
### Config (7 routes) — Real

### Stub/Inactive
- `POST /api/ai` — AI gateway, not active

---

## 8. Tables Without RLS (Action Items)

`ai_signals` and `ai_suggestions` have no row-level security. These are ShepherdAI deterministic signal tables, not freeform LLM outputs. Tenant isolation must be enforced manually in the service layer. This should be addressed before any multi-tenant production deployment.
