# Council Review 27: Write-Path Integrity Closeout

Date: 2026-10-08
Branch: `fix/write-path-integrity-closeout`
Decision: **approve for protected PR delivery**

## Scope Reviewed

- Owner-approved deferral of the uncoached pilot and promotion of write-path integrity to the active MVP gate
- Guardian absence-alert preference persistence and notifier query repair
- Removal of the temporary Postgres-error allowance
- E2E database read-back and write-path coverage matrix
- Current status and competitive evaluation reconciliation

## Council Findings

### Product And SIS

Approved. A preference control that only echoed success was not a working SIS workflow. Persisting
the choice per guardian/student relationship gives the endpoint real behavior and matches the
relationship-scoped guardian model.

### Architecture And Data

Approved. The additive boolean migration defaults existing active relationships to alerts enabled,
preserving ADR-0053's default opt-in. Relationship scope avoids incorrectly applying a guardian's
choice for one student to all linked students.

### Security And Privacy

Approved. The mutation requires the guardian role and enabled capability, updates only an active
relationship matching tenant, authenticated guardian, and requested student, and returns 403 when
that relationship is absent. The notifier uses the same tenant-scoped relationship.

### UX And Accessibility

Approved. No visible UI changed. The existing API contract now persists exactly the boolean it
returns. Invalid or missing boolean input is rejected instead of silently enabling alerts.

### Competitive Council

Approved. This work strengthens reliability of an existing guardian workflow without expanding
scope or making production, Title IV, provider, or pilot-fit claims.

### Testing Council

Approved. Unit coverage verifies notifier use of the real
column. The guardian journey toggles the preference and reads the database value back. The full
reset-backed suite passed 431 checks with 332 intentional skips; five occurrences from the two
deliberate HQ rejection classes were expected and zero Postgres errors were unexpected.

### Documenter

Approved. The canonical guide, project status, changelog, audit matrix, Council record, factory
record, and current evaluation describe the same owner decision and release boundary.

## pr-review Gate

Final diff review found and resolved one Important scope issue: the preference mutation initially
matched any active relationship instead of only parent/guardian relationships. One stale notifier
visibility filter and one incorrect E2E fixture join were also corrected during implementation.
After those fixes, the final result is 0 Critical, 0 Important, and 0 Minor findings.
