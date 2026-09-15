# Council Review V — Agent 4: Feature & Competitive Audit

_Date: 2026-06-18_

## 1. Phase Completion

| Phase | Status | % | Notes |
|---|---|---|---|
| Phase 0 — Product & Factory | Complete | 100% | Vision, master plan, factory defined |
| Phase 1 — Institution Config | Complete | 100% | Tenant model, types, migrations, API, admin UI |
| Phase 2 — Academic Calendar | Complete | 100% | Terms, sessions, subdivisions, admin UI |
| Phase 3 — Course Catalog | Complete | 100% | Courses, sections, prerequisites, instructor assignment |
| Phase 4 — People & Roles | Complete | 100% | Students, staff, guardians, roles, relationships |
| Phase 5 — Grading & Transcripts | Complete | 100% | Scales, rules, GPA, academic standing, transcript evaluator |
| Phase 6 — Student PWA | Partial | 90% | Shell, manifest, dashboard reads, offline; missing: registration UI |
| Phase 7 — LMS Contract | Complete | 100% | Interfaces, no-LMS provider, contract tests |
| Phase 8 — Moodle Adapter | Complete | 100% | SSO, course/roster sync, grade return, reconciliation |
| Phase 9 — Canvas Adapter | Complete | 95% | All sprints delivered |
| Phase 10 — ShepherdAI Foundation | Partial | 20% | LLIS consent/audit approved; signals blocked; zero production signal generation |
| Phase 11 — Admissions CRM | Partial | 40% | Application→decision→conversion slice complete; fee collection, bulk comms, lead pipeline not started |
| Phase 12–22 | Not Started | 0% | Billing, financial aid, formation, compliance, all deferred |

## 2. User Type Coverage

| User Type | Coverage % | Key Gap |
|---|---|---|
| Institution Admin | 85% | Missing: billing reports, custom reporting, system health |
| Registrar | 75% | Missing: enrollment conversion UI, transcript issuance workflow, holds, attendance entry |
| Dean/Academic Admin | 65% | Missing: program requirement audits, faculty load monitoring, cohort management |
| Faculty/Professor | 10% | Can be assigned to sections only; missing: grade entry, advising notes, assignment CRUD |
| Student (PWA) | 70% | Missing: registration UI, transcript request, graduation readiness, messaging |
| Guardian | 15% | Role exists; missing: portal UI, child progress visibility, communication prefs |
| Admissions Officer | 60% | Missing: lead pipeline, bulk comms, applicant status portal, reference collection |

## 3. Core SIS Workflows

| Workflow | % | Gap |
|---|---|---|
| Application → Admission → Enrollment | 60% | Fee collection, applicant portal, lead tracking, bulk outreach missing |
| Course Catalog | 100% | Complete |
| Section Scheduling | 90% | Missing: schedule conflict detection, room assignment, time pattern builder |
| Grade Entry & Transcripts | 70% | Missing: faculty grade entry UI, transcript posting, hold release, degree conferral |
| Academic Standing | 100% | Complete |
| Guardian Visibility | 15% | Portal UI, scoped progress view, communication prefs missing |
| Calendar & Terms | 100% | Complete |
| Reporting & Analytics | 20% | IPEDS/ATS compliance, enrollment headcount, custom report builder, retention dashboards missing |

## 4. Top 5 Competitive Gaps vs. Populi / Orbund / Jenzabar

1. **No faculty grade entry or student registration UI.** Students cannot register for courses; faculty cannot enter grades. Schools cannot operate without these workflows. This alone blocks adoption by any institution.

2. **No financial management.** Populi includes integrated tuition billing, payment plans, FAFSA, and aid packaging. ChurchCore Academy has zero financial infrastructure. Faith schools must collect tuition.

3. **No admissions pipeline / lead nurture.** Inquiry→applicant→accepted→enrolled exists in the API. But no bulk outreach, no application fee collection, no lead aging, no applicant-facing status portal. Orbund and Populi both have mature CRM pipelines.

4. **No compliance reporting (ATS/IPEDS).** ATS-accredited seminaries require ATS reporting templates. Title IV institutions require IPEDS. Zero implementation exists. Schools cannot meet accreditor requirements with this system.

5. **ShepherdAI is a blocked foundation.** While architecturally differentiating, it generates zero production signals today. Formation records, competency grading, and narrative evaluation remain design-only. Competitors offer at least faculty-facing gradebooks and advising notes.

## 5. MVP Readiness Score: 35/100

**What works (35 points):** Tenant configuration, academic calendar, course catalog, LMS integration (Moodle + Canvas + no-LMS), student PWA read surfaces, admissions application-to-acceptance, auth and role matrix, database RLS and security foundation.

**What's missing (65 points):** Faculty grade entry, student registration, tuition billing, financial aid, transcript issuance workflow, admissions lead pipeline, compliance reporting (ATS/IPEDS), formation records, ShepherdAI signals.

**Verdict:** Production-quality infrastructure with zero user-facing operational workflows for the daily operations a school needs. Not MVP. This is a working foundation awaiting user-facing domain slices.

**Ship readiness path:** Phase 11 Admissions CRM completion (fee collection + lead pipeline) + Phase 12 Billing + compliance reporting = ~65–70% MVP. Estimated 3–4 more factory sprint cycles.
