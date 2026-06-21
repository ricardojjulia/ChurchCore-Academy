# Full SIS MVP Change Management

**Date:** 2026-06-21  
**Change type:** Product governance, release sequencing, AI execution prompts  
**Source:** Council Review VII  
**Status:** Approved for factory planning; implementation requires slice-by-slice execution.  

## Change Summary

ChurchCore Academy will stop treating broad surface coverage as sufficient MVP evidence. The new change-management standard is full workflow completion: each SIS function must support persisted state, role-gated operations, UI/PWA completion, auditability where required, tests, docs, and release evidence.

## Affected Areas

- Admissions and applicant portal
- Registration and enrollment confirmation
- Attendance
- Grade posting and official academic records
- Transcript requests and issuance
- Billing and student accounts
- Financial aid
- Reporting and exports
- Notifications and communications
- Student PWA
- Guardian portal
- LMS synchronization workers
- ShepherdAI workflow recommendations

## Change Control Rules

1. No implementation starts without a factory intake, spec, plan, and verification strategy.
2. No workflow is considered complete if it only renders a screen.
3. No student-facing workflow exposes records until release/hold/privacy rules are tested.
4. No billing or aid workflow ships without explicit compliance and audit review.
5. No LMS workflow mutates official records directly; all returns remain Academy-reviewed imports.
6. No ShepherdAI recommendation may create official academic, financial, aid, or transcript decisions automatically.
7. Every slice updates project status, roadmap, runbooks, and prompt packs when its completion changes the readiness path.

## Stakeholders

| Stakeholder | Concern |
| --- | --- |
| Institution admin | Can the institution operate without spreadsheets? |
| Registrar | Are enrollment, transcript, and official records auditable? |
| Faculty | Can daily attendance and grade posting be completed? |
| Student | Can self-service registration, billing, transcript, and messages be completed? |
| Guardian | Are minor-related records visible only when allowed? |
| Finance/admin staff | Are billing, payments, and aid auditable and reportable? |
| Security/privacy reviewer | Are tenant, role, RLS, and sensitive records protected? |
| Release validator | Are tests, build, docs, and browser evidence sufficient? |

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Attempting a single massive SIS implementation | Critical | Use ADR-0033 release slices only. |
| Screen-only completion misrepresented as workflow completion | High | Require persisted transaction and verification evidence. |
| Billing/payment compliance mistakes | High | Separate billing and aid slices with audit and provider decisions. |
| Student PWA exposing unreleased grades/transcripts | High | Use release-state filters and guardian relationship checks. |
| LMS sync mutating official records | High | Keep reviewed-import workflow boundary. |
| Reporting built from inconsistent tables | Medium | Define canonical read models per reporting domain. |

## Acceptance Gates

Each slice must pass:

```bash
npm test
npm run lint
npm run build
```

Additional gates are required by scope:

- migrations and seed replay for schema changes;
- role-matrix verification for protected workflow changes;
- browser verification for UI/PWA changes;
- provider contract tests for LMS slices;
- security/privacy review for transcripts, payments, aid, guardian, and ShepherdAI data.

## Communication Plan

- Council review records major decisions in `docs/reviews/`.
- ADRs record durable architecture decisions.
- Specs and plans record implementation intent before code.
- Runbooks record operator procedures.
- Project status and roadmap record implemented versus planned work.
- AI prompt packs carry exact execution instructions for future coding sessions.
