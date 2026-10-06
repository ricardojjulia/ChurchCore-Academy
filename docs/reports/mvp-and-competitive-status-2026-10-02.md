# ChurchCore Academy - MVP and Competitive Status

Date: 2026-10-02
Scope: `main` through PR `#206` (`a66a304`)
Status: historical evaluation through PR `#206`; delivery status reconciled 2026-10-05

## Bottom Line

ChurchCore Academy is a controlled-pilot candidate for faith-based Bible schools,
seminaries, ministry institutes, and similar small institutions that do not need
U.S. Title IV automation on day one. It is not deployed and is not approved for
general availability or unrestricted production official-record use.

The repository-owned MVP is complete and the approved first-customer P1 slices
have shipped:

- All 11 Core Academic Loop steps are automated in the production-build e2e gate.
- Trusted public institution resolution is implemented and fails closed.
- Initial custom reporting, bulk email, donor campaigns, advisor caseload, and
  faculty teaching-load workspaces are implemented.
- OneRoster deletion reconciliation is implemented with delivered-state
  provenance; external LMS validation remains an activation gate.

The faculty-load correctness closeout shipped through protected main in PR `#217`.
The next useful evidence is an uncoached, authenticated pilot or design-partner
walkthrough using `docs/acceptance/uncoached-pilot-session.md`. Deployment or
hosted-resource creation still requires explicit owner approval.

## Evidence Since The 2026-09-25 Evaluation

| Outcome | Evidence |
| --- | --- |
| Core loop steps 9 and 11 automated | PRs `#196` and `#197` |
| Constrained custom report builder | PR `#198` |
| Manual bulk email workflow | PR `#199` |
| Donor campaign management | PR `#200` |
| Trusted public tenant resolution | PR `#201`; issue `#162` closed |
| OneRoster deletion reconciliation | PR `#202`; issue `#164` closed |
| Advisor caseload intelligence | PR `#204`; issue `#203` closed |
| Faculty teaching-load intelligence | Initial slice in PR `#206`; issue `#216` tracks incomplete-value accuracy and primary-path E2E follow-up |

The final PR in this sequence passed the required hosted CI, CodeQL, and
production-build E2E checks. Its local final verification recorded 2,071 tests,
lint, build, governance checks, and 408 passed E2E checks with 330 role/surface
combinations intentionally skipped by access expectations.

## MVP Status

| Area | Current status |
| --- | --- |
| Core Academic Loop | Complete and automated in CI |
| Admin, faculty, student, guardian, and applicant surfaces | Implemented and role-gated |
| Admissions through student conversion | Implemented |
| Grade-to-transcript handoff | Implemented and automated |
| Tenant and role enforcement | Required in module/data paths and exercised by coverage gates |
| Public institution selection | Trusted published host/slug mapping; unknown routes fail closed |
| Academy-to-LMS roster delivery | OneRoster CSV Binding 1.2.1 export, signed delivery, and deletion reconciliation implemented |
| Live deployment | Not started; owner approval required |
| Faculty-load closeout | Issue `#216` shipped in PR `#217`; ready for pilot observation |
| Real-institution pilot evidence | Not yet recorded |

## Competitive Position

### Strong Fit Today

- Configurable academic structures for Bible schools, seminaries, ministry
  institutes, colleges, universities, and children's programs.
- Faith-specific ministry formation, covenant, denomination, and ordination data.
- Admissions, student/faculty/guardian portals, academic records, billing and aid
  foundations, reporting, communications, alumni/giving, and LMS contracts.
- Explainable ShepherdAI academic workflows plus human-reviewed advising and
  faculty-load evidence.
- A required production-build E2E gate spanning surfaces, roles, tenant
  boundaries, and the Core Academic Loop.

### Conditional Or Evidence-Gated

- Multilingual UI needs a selected customer language before implementation.
- Alumni directory, richer segmentation, report scheduling, SMS, advising, and
  faculty-load expansions need pilot evidence before scope is authorized.
- Moodle, Canvas, and ChurchCore LMS activation need external tenant/provider
  evidence even though repository-side contracts and OneRoster delivery exist.
- Payments and communications need live-provider approval and operational proof.

### Not Ready For Title IV Replacement Claims

- FAFSA/ISIR import is not implemented and requires compliance/data approval.
- COD transmission is not implemented and requires provider, rollback, and audit
  approval.
- IPEDS and ATS outputs remain review-required snapshots, not certified filings.

## Recommended Next Move

Run one uncoached, authenticated pilot/design-partner session against a
representative institution profile and record observed completion, confusion,
dead ends, authorization failures, and requested capabilities. Turn only observed
failures or adoption blockers into the next repository stories.

This recommendation does not authorize deployment. If a suitable local or
already-approved environment cannot support the session, the owner must first
approve the staging deployment runbook and hosted resources. Multilingual or
Title IV work should begin only when its existing customer/compliance gate is met.

## Residual Risk

- Automated verification proves repository behavior, not operational fit in a
  real institution.
- No live deployment, provider activation, backup/restore exercise, or hosted
  observability evidence exists for Academy.
- Institution-specific policy configuration may expose gaps not represented in
  the acceptance data.
- Faculty-load unknown-value semantics are automated, but their clarity to a real
  institutional operator remains unverified until the pilot session.
- Competitive claims remain bounded to controlled-pilot and design-partner use.

## Method

This evaluation reconciled the current development guide, merged PRs `#196`
through `#206`, issue state, final PR checks, factory/Council records, and the
repository's required verification gates. The 2026-09-25 report remains historical
evidence but is superseded for current planning.
