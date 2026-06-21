# ADR-0033 — Full SIS Competitive MVP Release Program

**Status:** Accepted  
**Date:** 2026-06-21  
**Deciders:** Council Review VII, Ricardo Julia  

## Context

ChurchCore Academy has moved beyond prototype foundations. The product now has verified-session auth, request-scoped RLS, admissions, enrollment conversion, gradebook foundation, Student PWA read surfaces, LMS provider contracts, and ShepherdAI signals.

However, a full SIS claim requires operational completion across admissions, registration, attendance, grade posting, transcript issuance, billing, aid, reporting, communications, student self-service, and LMS synchronization. Current competitor positioning from Populi, Orbund, and Classter confirms that integrated admissions, billing/finance, reporting, communications, and self-service are table-stakes capabilities in the SIS market.

The risk is scope collapse: attempting to build every missing function at once would create a large, unreviewable change and would violate the software factory's sprint discipline.

## Decision

ChurchCore Academy will use a **Full SIS Competitive MVP release program**.

Each release slice must complete one end-to-end SIS workflow and must include:

1. Product/factory intake.
2. Design spec in `docs/superpowers/specs/`.
3. Implementation plan in `docs/superpowers/plans/`.
4. ADR when persistence, audit, policy, official records, payments, aid, LMS sync, or Student PWA exposure changes.
5. Database migrations and RLS when state is persisted.
6. Policy/service/repository/API implementation.
7. Admin, faculty, student, or guardian UI as required.
8. Tests and role-matrix verification.
9. Docs, runbooks, and change-management updates.
10. Council/reviewer closeout before marking the slice production-ready.

The approved order is:

1. Course-section registration and enrollment confirmation.
2. Attendance and production grade posting.
3. Transcript request, issuance, hold, release, revoke.
4. Billing, payments, and student account ledger.
5. Financial aid foundation.
6. Reporting and exports.
7. Notifications and communications.
8. Student PWA workflow completion.
9. LMS execution workers and reconciliation acceptance.
10. Competitive acceptance and onboarding readiness.

## Consequences

Positive:

- Prevents "all screens exist" from being confused with "all workflows work."
- Gives AI coding agents a clear execution sequence.
- Forces every slice through tenant isolation, audit, tests, and docs.
- Preserves ChurchCore Academy's differentiators while closing table-stakes SIS gaps.

Negative:

- Full competitive readiness will require multiple factory sprints.
- Billing and aid introduce higher compliance risk and may require external provider decisions.
- Student PWA completion depends on workflow states from earlier slices.

## Alternatives Considered

### Build all remaining SIS workflows in one release

Rejected. The scope is too broad for safe implementation and review.

### Focus only on competitive differentiators such as ShepherdAI

Rejected. ShepherdAI is a differentiator, but institutions cannot adopt without registration, transcripts, billing, reporting, and communications.

### Keep adding screens without workflow depth

Rejected. Council Review VII treats screen-only completion as a false MVP signal.

## Review Notes

- **Product boundary:** Academy remains the SIS and official-record authority.
- **Security/privacy:** Student records, grades, transcripts, payments, aid, guardian access, and communications are high-risk and require role/RLS gates.
- **Testing:** Every slice requires deterministic tests plus role-matrix and browser verification where applicable.
- **Rollback:** Each slice must be independently deployable and reversible except immutable audit/event records, which require forward recovery.

## Related

- `docs/reviews/2026-06-21-council-review-7-full-sis-mvp-competitiveness.md`
- `docs/software-factory.md`
- `docs/product/factory-roadmap.md`
- ADR-0011 Official Record Transcript And Audit Model
- ADR-0021 Accepted Application Enrollment Conversion
- ADR-0028 Gradebook API Route Contract
- ADR-0030 Legacy Dataset Deprecation Strategy
- ADR-0031 Workflow Evaluator Invocation Pattern
