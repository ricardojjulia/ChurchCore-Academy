# Council Review VI — Agent 4: Feature & Competitive Audit

_Date: 2026-06-18_

## 1. Phase Completion

| Phase | % | Notes |
|---|---|---|
| 0 — Foundation | 100% | |
| 1 — Institution Config | 100% | |
| 2 — Academic Calendar | 100% | |
| 3 — Course Catalog | 100% | |
| 4 — People & Roles | 100% | |
| 5 — Grading & Transcripts | 95% | Transcript issuance has no write workflow |
| 6 — Student PWA | 65% | Read surfaces done; registration, messaging, transcript request missing |
| 7 — LMS Contract | 100% | |
| 8 — Moodle Adapter | 100% | |
| 9 — Canvas Adapter | 90% | Browser acceptance test pending |
| 10 — ShepherdAI | 40% | Signal engine + UI done; early alert and graduation intelligence not wired |
| 11 — Admissions CRM | 35% | Staff pipeline done; applicant portal, fee collection, lead pipeline missing |
| 12–22 | 0% | Billing, aid, formation, reporting, alumni not started |

## 2. User Type Coverage

| User Type | % | Key Gap |
|---|---|---|
| Institution Admin | 60% | No billing, financial aid, compliance reports |
| Registrar | 45% | No transcript write/release, no enrollment holds |
| Dean / Academic Admin | 40% | No FERPA actions, no faculty load review, no ATS reporting |
| Faculty / Professor | 55% | Gradebook, attendance, roster present; no advising notes, no credential records |
| Student (PWA) | 50% | Read surfaces present; no registration, transcript request, messaging |
| Guardian | 40% | Dashboard present; no messaging, no consent management |
| Admissions Officer | 35% | Staff pipeline present; no applicant portal, no fee collection |

## 3. Core SIS Workflows

| Workflow | % | Gap |
|---|---|---|
| Application → Admission → Enrollment | 55% | No applicant self-service, no fee collection, no enrollment agreement |
| Course Catalog | 90% | No self-service browse or management API |
| Section Scheduling | 70% | No scheduling grid, conflict detection, or capacity UI |
| Grade Entry & Transcripts | 60% | Faculty gradebook entry done; no transcript release workflow |
| Academic Standing | 50% | Evaluator logic exists; not surfaced as actionable workflow |
| Guardian Visibility | 55% | Dashboard present; no messaging or consent management |
| Calendar & Terms | 90% | No enrollment window enforcement in registration flow |
| Reporting & Analytics | 20% | Gradebook averages only; no headcount, retention, ATS, IPEDS |

## 4. Top 5 Competitive Gaps

1. **No student billing or payments.** Every institution that charges tuition cannot operate. Hard adoption blocker.
2. **No admissions self-service portal.** Prospective students have no place to apply. All admissions intake is staff-only.
3. **No compliance or reporting output.** ATS/IPEDS missing. Schools under accreditation cannot use this as system of record.
4. **No faculty qualification/credential records.** ATS requires faculty credential tracking for each course taught. Seminary customers will immediately identify this gap.
5. **Transcript issuance has no write workflow.** The migration, module, and repository exist but there is no staff UI to issue or release a transcript and no student-side request flow.

## 5. MVP Readiness Score: 28/100

Strong foundation: tenant isolation, session-verified auth, audit trail, LMS contract, working admissions pipeline, ShepherdAI signal engine. These are real and non-trivial.

Missing for operational readiness: student billing, applicant portal, transcript release workflow, compliance reporting, second-tenant support (blocked by legacy dataset). A school cannot run on this today.

**Readiness path:** Legacy dataset migration (33 pages) + transcript issuance workflow + course registration UI + billing foundation = ~55% MVP. Estimated 4–6 factory sprint cycles.
