# Reporting And Exports Runbook

Date: 2026-06-21
Applies to: Slice 6 Reporting And Exports

## Supported Reports

- Enrollment
- Admissions
- Attendance
- Grades
- Transcripts
- Billing
- Financial aid
- Retention
- Program completion

## Export Workflow

1. Sign in as an institution administrator, registrar, academic administrator, or dean.
2. Open `/admin/reporting`.
3. Review summary cards and report previews.
4. Use the CSV export action for the required report.
5. Store exported files according to the institution's student-record retention policy.

## Controls

- Reports are scoped to the verified actor's tenant.
- Tenant id is never accepted from the export URL.
- Student, guardian, applicant, and faculty-only users cannot access report exports.
- CSV output escapes fields and prefixes spreadsheet formula-like values.
- Reports are operational exports, not final certified ATS/IPEDS filings.

## Compliance Notes

The reporting foundation provides ATS/IPEDS-ready source rows but does not certify regulatory submission formats. Final compliance reporting requires a future release gate that maps each field to the current accreditor or federal definition and validates institution-specific eligibility.

## Verification Commands

```bash
node --import tsx --test src/modules/reporting/__tests__/service.test.ts src/app/api/academy/reports/__tests__/route.test.ts
npx tsc --noEmit
npm test
npm run lint
npm run build
```
