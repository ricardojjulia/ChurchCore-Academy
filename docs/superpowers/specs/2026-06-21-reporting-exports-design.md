# Reporting And Exports Design

Date: 2026-06-21
Governing ADRs: ADR-0033 Full SIS Competitive MVP Release Program, ADR-0029 Official Records Print And Export Strategy
Slice: 6

## Purpose

Make reporting operational instead of page-local. Administrators need canonical report models, role-gated export endpoints, and CSV output for board, accreditation, and operational review.

## Scope

In scope:

- Canonical report definitions for enrollment, admissions, attendance, grades, transcripts, billing, financial aid, retention, and program completion.
- Tenant-scoped Postgres read model for those reports.
- CSV serialization with stable column order and formula-injection protection.
- Role-gated report API endpoint for JSON and CSV output.
- `/admin/reporting` UI backed by the reporting module with export actions.
- Runbook documenting supported MVP exports and compliance caveats.

Out of scope:

- Final ATS/IPEDS certification.
- XLSX/PDF generation.
- User-authored custom report builder.
- Scheduled report delivery.
- Cross-tenant analytics.

## Actors And Roles

- Institution admin, registrar, academic admin, dean: can read and export reports.
- Finance/admin roles represented by existing admin roles can view billing and aid exports in this MVP.
- Student, guardian, applicant, and faculty-only actors cannot access exports.

## Data Boundary

Primary reads:

- admissions applications and conversion events
- student profiles, programs, period registrations, section registrations
- attendance sessions/records
- gradebook course summaries
- transcript requests and issuances
- billing ledger entries
- aid packages, awards, disbursements, holds

All queries must include tenant predicates. No report endpoint may accept tenant id from the caller.

## Runtime Behavior

1. Admin opens `/admin/reporting`.
2. Page loads the reporting dashboard from the module through request-scoped database context.
3. The dashboard shows summary cards and report sections.
4. Export buttons link to `/api/academy/reports?report=<type>&format=csv`.
5. API resolves the verified Academy actor from session.
6. Service enforces role access, loads the requested tenant-scoped report, and returns JSON or CSV.

## Compliance Boundary

The slice creates ATS/IPEDS-ready foundations: stable export shapes, program completion rows, enrollment rows, attendance rows, grade rows, and finance/aid rows. It does not claim final ATS/IPEDS certification.

## Acceptance Criteria

- Every supported report has stable id, label, description, and CSV columns.
- CSV output escapes values and protects against spreadsheet formula injection.
- Report service denies non-admin actors.
- Report endpoint defaults to JSON and can return CSV with attachment headers.
- Admin page uses the reporting module rather than page-local ad hoc aggregation.
- Snapshot tests cover rows and CSV output.
- Route tests cover role gates, tenant scoping through actor context, and CSV content type.
- `npm test`, `npm run lint`, `npm run build`, and protected-route HTTP smoke pass.
