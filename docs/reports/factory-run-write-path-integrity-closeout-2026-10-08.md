# Factory Run: Write-Path Integrity Closeout

Date: 2026-10-08
Branch: `fix/write-path-integrity-closeout`
Product area: acceptance integrity, attendance guardian notifications, governance

## Intent And Boundaries

Close the owner-selected integrity gate before more feature work. Repair the remaining known silent
guardian preference write/query defect, prove persistence, inventory operational write coverage,
and reconcile planning documents. No hosted deployment, provider activation, LMS runtime work,
identity redesign, or new product feature is authorized.

## Discovery And Technical Brief

The notifier read a nonexistent JSON column on `academy_people`; an E2E allowlist hid the resulting
Postgres error. The matching guardian API accepted a boolean but performed no update. The approved
design adds a default-true preference to `academy_student_relationships`, because access and consent
already vary by guardian/student relationship. The route performs a tenant-, actor-, student-, and
active-status-scoped update and returns the persisted value.

## Verification Record

Final results before PR delivery:

- Focused guardian journey with database reset: passed 6/6; 0 expected and 0 unexpected Postgres errors
- Migration rehearsal: passed twice from a clean reset, including `20261008160000_guardian_absence_alert_preferences.sql`
- Authorization/validation: 400 for non-boolean input, 403 for an unrelated student, persisted read-back for the linked student
- `npm run verify:governance`: passed
- `npm run verify`: passed (2,226 tests; lint with no warnings/errors; production build on Next.js 16.3.6)
- `npm run test:full -- --reset-db`: passed (431 checks; 332 intentional skips; 5 expected HQ rejection occurrences; 0 unexpected Postgres errors)
- Council Review 27 and Testing Council: approved
- Documenter: complete
- `pr-review`: passed with 0 Critical, 0 Important, and 0 Minor findings

## Residual Risks

Live providers and hosted deployment remain external gates. The uncoached participant pilot remains
deferred. The full E2E guard can prove only paths the suite executes; the static swallowed-error test
and coverage matrix reduce, but cannot eliminate, omissions in future code.
