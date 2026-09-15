# Council Review VII — Full SIS MVP And Competitive Readiness

**Date:** 2026-06-21  
**Scope:** ChurchCore Academy as a fully working SIS where all screens, options, and core SIS workflows can be completed end-to-end.  
**Decision:** Unanimous conditional approval of a staged Full SIS Competitive MVP program.  

## Council Verdict

ChurchCore Academy is **not yet a fully working competitive SIS**. It has a serious foundation: verified-session auth, forced RLS, tenant-scoped data access, admissions decisioning, enrollment conversion, gradebook foundation, Student PWA read surfaces, LMS provider contracts, and ShepherdAI workflow signals.

The product still cannot honestly be sold or described as a full production SIS because several operational workflows are incomplete or missing:

- applicant self-service and application fee collection;
- course-section registration and enrollment confirmation;
- production attendance capture and faculty grade posting;
- registrar-controlled transcript issuance and student transcript requests;
- billing, payments, student accounts, and financial aid;
- reporting, exports, compliance, and institutional analytics;
- notifications, messaging, and communications;
- complete Student PWA write workflows;
- LMS execution workers beyond contract and reviewed-import foundations.

## Updated MVP Readiness Score

| Dimension | Score | Notes |
| --- | ---: | --- |
| Security foundation | 75/100 | Release 1 gate closed; later workflow role matrices still required. |
| Data architecture | 70/100 | Tenant/RLS pattern is strong; some domains still need write workflows and reporting models. |
| Admin/registrar workflow completeness | 40/100 | Admissions and conversion exist; registration, transcripts, billing, aid, reporting remain blockers. |
| Faculty workflow completeness | 50/100 | Gradebook and attendance surfaces exist; production-grade posting and advising records need completion. |
| Student/guardian self-service | 35/100 | Student PWA reads exist; registration, transcript request, messages, billing, guardian actions are incomplete. |
| LMS/integration readiness | 55/100 | Provider-neutral contract is strong; executable workers and live acceptance remain incomplete. |
| Competitive parity | 32/100 | Populi, Orbund, and Classter advertise integrated admissions, billing/finance, reporting, and communications. |

**Council score:** 43/100 for full SIS competitive readiness.  
**Prior Council VI score:** 28/100.  
**Reason for improvement:** ADR-0030 runtime migration, Release 1 security closeout, admin evaluator removal, and merged working-surface improvements.  
**Reason score remains low:** the missing workflows are not polish; they are table-stakes SIS capabilities.

## Competitive Baseline

The council used repository docs plus current public competitor positioning:

- Populi markets an all-in-one college platform covering SIS, LMS, billing, financial aid, admissions CRM, and reporting: https://populi.co/
- Populi Financial documents billing, payment plans, reporting, and financial-aid management: https://support.populiweb.com/hc/en-us/articles/223796447-Introduction-to-Populi-Financial
- Orbund positions its SIS around admissions, academics, compliance, billing, student success, finance, marketing, and reporting: https://orbund.com/student-information-system/
- Classter positions itself as an all-in-one SIS/SMS/LMS with admissions, academic management, finance, communication, and connected workflows: https://www.classter.com/

ChurchCore Academy's competitive advantage remains real: faith-based institution modeling, mixed-mode academic structures, provider-neutral LMS, guardian-aware Student PWA, and ShepherdAI. Those advantages do not compensate for missing billing, registration, transcript, reporting, and communications workflows.

## Unanimous Council Decision

The council unanimously approves the following idea:

> ChurchCore Academy must move from "broad foundations plus vertical slices" to a **Full SIS Competitive MVP release program** made of narrow, factory-governed workflow slices. Each slice must ship one complete end-to-end workflow with database persistence, role policy, API/service behavior, UI/PWA surface, tests, documentation, and release evidence.

The council unanimously rejects:

- claiming the system is a fully working SIS today;
- implementing all missing workflows as one giant change;
- adding UI screens that are not backed by persisted transactional workflows;
- using ShepherdAI or LMS adapters to mask missing SIS operations;
- shipping student finance, aid, or transcript workflows without audit and role gates.

## Approved Release Sequence

| Order | Slice | Why It Comes Here |
| ---: | --- | --- |
| 1 | Course-section registration and enrollment confirmation | Converts admitted/enrolled students into actual class participation. |
| 2 | Attendance and production grade posting | Makes faculty daily operations real. |
| 3 | Transcript request, issuance, hold, release, revoke | Makes official records operational and auditable. |
| 4 | Billing, payments, and student account ledger | Required for any tuition-charging institution. |
| 5 | Financial aid foundation | Required for regulated programs; separate compliance gate. |
| 6 | Reporting and exports | Required for administrators, accreditation, and board reporting. |
| 7 | Notifications and communications | Required for applicant, student, guardian, and staff workflow completion. |
| 8 | Student PWA workflow completion | Exposes registration, transcript, billing, messages, progress, and documents safely. |
| 9 | LMS execution workers and reconciliation acceptance | Makes external provider sync operational rather than contract-only. |
| 10 | Competitive acceptance and onboarding readiness | Browser role matrix, seeded/live tenant rehearsal, docs, support runbooks. |

## Required ADR And Change Management

This review is implemented by:

- `docs/adr/0033-full-sis-competitive-mvp-release-program.md`
- `docs/change-management/2026-06-21-full-sis-mvp-change-management.md`
- `docs/superpowers/specs/2026-06-21-full-sis-competitive-mvp-program-design.md`
- `docs/superpowers/plans/2026-06-21-full-sis-competitive-mvp-program.md`
- `docs/prompts/2026-06-21-full-sis-mvp-factory-prompts.md`

## Release Gate

No slice may be marked complete until it has:

- a focused spec and implementation plan;
- tests written before or alongside implementation;
- tenant/RLS and role-policy verification;
- UI/PWA browser verification when applicable;
- `npm test`, `npm run lint`, and `npm run build` evidence;
- docs and runbook updates;
- a council or reviewer decision of `ship`.
