# Financial Aid Foundation Design

Date: 2026-06-21
Governing ADRs: ADR-0033 Full SIS Competitive MVP Release Program, ADR-0035 Billing Ledger And Payment Boundary, ADR-0036 Regulated Aid Activation Boundary
Slice: 5

## Purpose

Deliver the first real financial-aid workflow for ChurchCore Academy: institutional aid packages, awards, disbursement scheduling, billing-ledger posting, aid holds, and student aid visibility.

## Scope

In scope:

- Institutional aid packages by student and aid year.
- Institutional awards with offered, accepted, declined, and cancelled statuses.
- Disbursement schedule records with idempotent mutation keys.
- Posting accepted scheduled disbursements as billing ledger credits.
- Aid holds for documentation and internal review.
- Admin financial-aid page and workflow form.
- Student PWA aid page.
- API route for read and mutation workflows.
- RLS and role gates.

Out of scope:

- Federal, Title IV, state, or loan processing.
- SAP calculations and appeals.
- Return-to-Title-IV or refund calculations.
- Document collection workflow.
- External financial-aid system integration.
- Automated eligibility decisions.

## Actors And Roles

- Institution admin, registrar, academic admin, dean: can create and maintain institutional aid records.
- Student: can read only their own released aid summary.
- Faculty, guardian, applicant: no aid mutation access in this slice.

## Data Boundary

Primary writes:

- `academy_aid_packages`
- `academy_aid_awards`
- `academy_aid_disbursements`
- `academy_aid_holds`
- `academy_billing_ledger_entries` for posted disbursement credits

Primary reads:

- `academy_student_profiles`
- `academy_people`
- `academy_aid_packages`
- `academy_aid_awards`
- `academy_aid_disbursements`
- `academy_aid_holds`

All runtime access uses verified Academy actor identity and request-scoped database context.

## Runtime Behavior

1. Aid admin opens `/admin/financial-aid`.
2. Admin creates an aid package for a student and aid year.
3. Admin creates an institutional award.
4. Admin accepts the award after institutional review.
5. Admin schedules a disbursement with an idempotency key.
6. Admin posts the accepted scheduled disbursement.
7. Repository writes an immutable billing ledger credit and links the disbursement to that entry.
8. Student opens `/student/aid` and sees awards, disbursements, and active holds.

## Regulated Aid Gate

Federal award types and federal source types are not allowed in database constraints. API/service code rejects federal aid inputs with an explicit compliance-gate conflict. UI copy states that federal and Title IV aid are disabled until a separate compliance release gate is approved.

## Acceptance Criteria

- Aid packages are tenant-scoped and replay-safe by student/year.
- Institutional awards can be created and accepted.
- Disbursement scheduling is idempotent.
- Posting a disbursement creates a billing ledger credit and records the ledger entry id.
- Student actor cannot read another student's aid summary.
- Non-aid roles cannot mutate aid records.
- Federal/regulated aid inputs are rejected.
- Admin financial-aid and Student PWA aid pages are reachable through navigation.
- Migration replay, focused tests, TypeScript, lint, and build pass.
