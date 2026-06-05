# ADR 0016: Moodle Credential And Endpoint Storage Model

Date: 2026-06-04
Status: accepted

## Context

ChurchCore Academy will connect tenant-selected Moodle providers to the provider-neutral LMS contract. Moodle integration requires deployment-specific values such as base URLs, Web Service tokens, OIDC configuration, LTI keys, webhook secrets, service-user identifiers, and capability metadata.

These values are sensitive or deployment-specific. If they leak into Academy domain records, Student PWA read models, audit metadata, logs, ShepherdAI signals, or browser responses, the Moodle adapter would violate the tenant isolation and provider-secret exclusion boundaries established by earlier LMS and Student PWA decisions.

## Decision

ChurchCore Academy will store Moodle credentials and endpoint configuration only in a future tenant-scoped provider configuration and secret layer.

The provider configuration record may store non-secret routing and capability metadata, such as tenant id, provider id, Moodle base URL, enabled sync families, launch mode, feature flags, and status. Secret material, including Web Service tokens, OIDC client secrets, LTI private keys, LTI shared secrets, webhook secrets, refresh tokens, and private signing keys, must be stored through the platform secret mechanism or encrypted secret table, not in ordinary Academy domain tables.

The Moodle adapter runtime will resolve credentials server-side at execution time. Browser-facing responses, Student PWA read models, course catalog records, people/guardian records, grading records, transcript records, ShepherdAI inputs, audit event metadata, reconciliation summaries, and provider selection views must never include Moodle tokens, OIDC secrets, LTI keys, raw Moodle payloads, or internal provider error bodies.

Moodle endpoint and credential updates must be tenant scoped, authorization checked, audit logged with redaction, and validated before activation. Validation should confirm that the base URL is HTTPS in production, the selected protocol is supported, required capabilities are present, and the credentials can perform only the configured sync families.

## Consequences

This preserves tenant isolation and keeps Moodle secrets out of student, guardian, academic, transcript, and AI surfaces.

It also lets future Moodle implementation rotate credentials, pause providers, and validate capability drift without changing Academy domain models.

The tradeoff is that Phase 8 runtime work must introduce a dedicated configuration/secret access path before live Moodle calls can run. Mocked contract tests should prove secret exclusion before any Moodle network client is added.

## Alternatives Considered

Store Moodle tokens on tenant provider selection:

- rejected because provider selection is an operational state record, not a secret store
- would increase the chance that tokens appear in admin views, audit metadata, or tests

Store Moodle identifiers and tokens on course or section mappings:

- rejected because course catalog and section data are SIS records and should not carry provider credentials
- would make provider rotation and no-LMS/Canvas parity harder

Use environment variables for every tenant:

- rejected for multi-tenant production because tenant onboarding, rotation, and suspension require tenant-scoped secret lifecycle
- acceptable only for local development or single-tenant smoke tests when no production secrets are committed or exposed

Return short-lived provider tokens to the Student PWA:

- rejected because Moodle Web Service tokens and launch credentials are server-side integration material, not browser artifacts

## Review Notes

- Product boundary: Academy remains the SIS authority; Moodle credentials only authorize provider adapter work.
- Security/privacy: Moodle secrets and raw provider payloads must not enter browser responses, logs, audit metadata, Student PWA read models, ShepherdAI signals, or Academy domain records.
- Testing: future implementation must include provider-secret exclusion tests for launch, audit, reconciliation, admin selection, and error-normalization paths.
- Rollback: this sprint changes docs only; future runtime storage should be additive and isolated to the provider configuration/secret layer.
