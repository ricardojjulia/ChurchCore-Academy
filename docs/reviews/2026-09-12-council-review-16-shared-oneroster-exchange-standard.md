# Council Review XVI - Shared OneRoster Exchange Standard

Date: 2026-09-12
Status: Ratified
Decision: Ship the shared OneRoster exchange program
Council: Architecture, Engineering, Security and Privacy, Product, QA, Data
Related: ADR 0069; ChurchCore LMS COUNCIL-2026-018

## Context

ChurchCore Academy and ChurchCore LMS need one professional exchange standard. Academy is the faith-based SIS and system of record. LMS is the learning runtime. The current Academy `lms-contract` and LMS OneRoster importer overlap in purpose but do not yet share one explicit standard contract.

Official standards review:

- OneRoster: primary roster, class, enrollment, academic-session, and gradebook exchange lane.
- Ed-Fi: broad SIS/data-hub reference model and future public agency adapter.
- PESC: official transcript, admissions, and registrar exchange.
- CLR: learner-owned verified achievement and credential exchange.

## Council Findings

Architecture: Approve OneRoster as the shared Academy/LMS boundary. Keep Academy as system of record and LMS as consumer/producer of reviewed learning outcomes.

Engineering: Approve phased implementation. Start with CSV contract and conformance tests, then add authenticated API exchange, scheduler, and gradebook return.

Security and Privacy: Approve only with explicit identity-linking and provisioning gates. Roster files may contain PII, but secrets and passwords must never be exported or persisted. LMS must not create privileged users from source rows.

Product: Approve. This turns bundled Academy plus LMS into a coherent product instead of two products glued together by local assumptions.

QA: Approve with cross-repo fixtures. Every export produced by Academy must be importable by LMS tests. Every LMS result return must enter Academy as reviewed, not official, data.

Data: Approve with provenance. Every source object needs a stable sourcedId, source hash, source status, external link, mutation history, and reconciliation path.

## Vote

Unanimous approval: 6/6.

## Binding Amendments

1. OneRoster is the Academy/LMS exchange standard, not the Academy internal canonical data model.
2. Academy must export from real persisted SIS data, not mock data.
3. LMS standalone mode must continue to work with no Academy or OneRoster configuration.
4. Auth user auto-provisioning remains deferred until a dedicated identity council decision approves it.
5. Grade and progress return must remain pending review in Academy until official-record workflows accept it.
6. Shared conformance fixtures must be checked in and run in both repositories.
7. Bulk omission reconciliation is allowed only for approved academic files and must produce auditable soft-deactivation.
8. Result return, guardians, demographics, and REST endpoints require their own verification evidence before they can be called complete.

## Implementation Program

### Phase 1: Shared Contract

- Add Academy OneRoster contract/export module.
- Preserve LMS OneRoster parser/importer as the receiving implementation.
- Document the shared file set, field set, source ID rules, manifest rules, PII policy, and verification matrix.
- Add tests for manifest modes, required references, CSV escaping, and credential exclusion.

### Phase 2: Academy Export From Real Data

- Build tenant-scoped repository queries for orgs, users, roles, academic sessions, courses, classes, and enrollments.
- Export only records visible through authorized Academy context.
- Add route and admin preview/download flow from `/admin/settings/lms`.
- Build shared fixture package that LMS imports in CI.

### Phase 3: LMS Import Hardening

- Align LMS importer with the shared Academy exporter.
- Keep validation-before-redaction.
- Keep service-only apply, source locks, provenance guards, and recent history.
- Add conformance fixtures from Academy.

### Phase 4: Scheduled Exchange And Reconciliation

- Add scheduled Academy export and LMS pull or push transport.
- Add idempotency keys, package hashes, retries, audit rows, and operator-visible reconciliation.
- Preserve LMS standalone mode and no-provider mode.

### Phase 5: Gradebook Return

- Implement OneRoster Gradebook Service style result return from LMS.
- Academy receives results as reviewed imports.
- Official transcript and grade records remain registrar-controlled.

### Phase 6: Professional Completeness

- Add REST Rostering Service endpoints, conformance mapping, operational runbook, browser verification, linked database tests, and release evidence.
- Consider 1EdTech certification only after file, REST, gradebook, security, and reconciliation tests are green.

## Definition Of Done

- [ ] Academy exports complete OneRoster roster packages from persisted SIS data.
- [ ] LMS imports Academy packages with no manual file edits.
- [ ] Cross-repo conformance fixtures pass in both repos.
- [ ] Identity linking is explicit and tenant-scoped.
- [ ] No secrets or passwords appear in exports, logs, staged payloads, or test output.
- [ ] Bulk omission reconciliation is covered by database tests.
- [ ] Gradebook return enters Academy as pending review.
- [ ] End-to-end browser verification proves an admin can preview, export, import, apply, reconcile, and review returned outcomes.
- [ ] `npm test`, lint, build, database lint, pgTAP suites, and diff checks pass in both repos.

## Verdict

The council ratifies OneRoster as the professional shared standard for ChurchCore Academy and ChurchCore LMS alignment. Execute in phases, with Phase 1 beginning immediately.
