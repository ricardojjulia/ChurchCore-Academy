# Council Review 16 - Shared OneRoster Standard

Date: 2026-09-12
Status: Accepted
Scope: ChurchCore Academy and ChurchCore LMS shared interoperability standard

## Decision

ChurchCore Academy and ChurchCore LMS will use OneRoster 1.2 as the first-party alignment and communication standard for roster, class, enrollment, and gradebook exchange.

Academy remains the SIS and system of record. LMS remains the learning delivery system. OneRoster is the contract between them, not a replacement for either product's internal schema.

## Council Agreement

Product agrees that customers should experience Academy and LMS as one bundled ChurchCore education platform, with OneRoster providing the reliable data contract behind the scenes.

Architecture agrees that Academy is the OneRoster Provider for rostering data and LMS is the OneRoster Consumer. LMS becomes a OneRoster Provider for gradebook and progress return once the reviewed-import lane is implemented in Academy.

Data agrees that both systems must use stable local IDs internally and keep OneRoster `sourcedId` values in explicit mapping/provenance tables. Cross-system IDs must never become primary keys in either product.

Security agrees that student records, enrollment records, grades, guardians, progress, and credentials are high-sensitivity education records. Implementations must use tenant-scoped connections, field allowlists, redacted logs, idempotency keys, audit trails, and soft deactivation.

Engineering agrees to replace ad hoc Moodle/Canvas-shaped roster sync as the primary internal path. Moodle and Canvas remain adapters, but ChurchCore Academy to ChurchCore LMS uses the OneRoster standard first.

QA agrees that "complete" means conformance-oriented tests, fixture packages, cross-tenant rejection, idempotent replay, quarantine/reconciliation paths, and browser/API verification for operator workflows.

## Standard Boundary

Primary now:

- OneRoster Rostering Service
- OneRoster CSV binding for deterministic package exchange
- Academy outbound export
- LMS inbound validation, preview, apply, provenance, and identity linking

Next:

- OneRoster Gradebook Service
- LMS result/progress return to Academy reviewed-import workflow
- scheduled pull/push automation with replay-safe jobs

Later:

- REST bindings
- resource service
- guardian/agent exchange after privacy review
- external certification profile hardening
- Ed-Fi adapter from an Academy canonical model
- PESC and CLR export lanes

## Accepted Target Profile

The target is not a vague "OneRoster-ish" bridge. It is a professional OneRoster program with these explicit profiles:

1. `churchcore-oneroster-rostering-csv-provider`
   - Owner: Academy
   - Direction: outbound
   - Data: orgs, users, roles, academic sessions, courses, classes, enrollments

2. `churchcore-oneroster-rostering-csv-consumer`
   - Owner: LMS
   - Direction: inbound
   - Data: same rostering file set

3. `churchcore-oneroster-gradebook-return`
   - Owner: LMS provider, Academy consumer
   - Direction: LMS to Academy
   - Data: categories, lineItems, results, scoreScales, assessment line items/results where supported

4. `churchcore-oneroster-rest`
   - Owner: both products
   - Direction: system-to-system
   - Data: same service model after CSV semantics are proven

## Implementation Rules

- Academy must not write LMS runtime state directly.
- LMS must not become the SIS.
- Both systems must accept standalone operation without OneRoster configured.
- Every sync job must be tenant-scoped, idempotent, auditable, replay-safe, and safe to retry.
- Bulk imports must reconcile omissions only for declared supported files.
- Delta imports must not infer deletions from absence.
- User account creation is not automatic. Roster users link to existing identities until an explicit provisioning review is approved.
- Privileged role changes require approval. Roster data may not silently promote someone to an administrative role.
- Grade/result return enters Academy as reviewed import data before it affects official records or transcripts.
- Raw packages and raw provider payloads are not long-lived application data unless explicitly retained behind a short-retention, private, tenant-scoped debug gate.

## Execution Order

1. Freeze a shared OneRoster profile module and conformance checklist in Academy.
2. Align LMS parser/validator with the shared profile and official CSV 1.2.1 file vocabulary.
3. Build Academy OneRoster CSV export from real SIS data.
4. Add cross-repo fixture parity tests: Academy export validates in LMS.
5. Add scheduled Academy to LMS exchange using the same staged preview/apply flow.
6. Implement OneRoster gradebook/result return into Academy reviewed imports.
7. Add REST provider/consumer endpoints after CSV behavior is stable.
8. Run certification-oriented conformance review before external claims.

## References

- OneRoster 1.2 Standard: https://standards.1edtech.org/oneroster/specifications/standards/v1p2/
- OneRoster CSV Binding 1.2.1: https://standards.1edtech.org/oneroster/specifications/standards/v1p2/csv
- OneRoster overview: https://www.1edtech.org/standards/oneroster
