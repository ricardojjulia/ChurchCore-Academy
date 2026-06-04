# ADR 0014: LMS Provider Contract And No-LMS Mode

Date: 2026-06-04
Status: accepted

## Context

ChurchCore Academy must support institutions that use Moodle, institutions that use Canvas, and institutions that do not use an LMS. Academy is the SIS and education-management system; the LMS is an external delivery runtime.

Earlier architecture accepted provider-neutral course shell mapping. Phase 6 added a Student PWA with provider-neutral LMS launch placeholders. Phase 7 now needs a contract that can support launch, logout, provisioning, mapping, roster sync, enrollment sync, grade return, progress return, webhooks, audit, and reconciliation without coupling Academy domain records to Moodle or Canvas internals.

## Decision

ChurchCore Academy will define one provider-neutral LMS contract implemented by Moodle, Canvas, and no-LMS providers.

Academy workflows will depend on declared provider capabilities and normalized operation results, not provider-specific branches. No-LMS mode will be a first-class provider implementation that returns safe unavailable or unsupported outcomes where external LMS behavior is not applicable.

Provider credentials, access tokens, launch secrets, webhook signatures, raw provider payloads, retry state, and provider runtime errors will belong to the future LMS integration layer. They must not be stored in Academy course catalog, people, grading, official-record, Student PWA, or ShepherdAI records.

Grade return and progress return will produce reviewed imports or proposed changes. Academy remains the authority for grading rules, official records, release decisions, transcript holds, guardian visibility, and Student PWA display.

## Consequences

This preserves the Academy/LMS boundary while allowing tenant-level provider choice.

It makes no-LMS institutions viable because Academy-owned schedules, courses, documents, progress, and Student PWA workflows do not depend on an external LMS.

It also gives future adapter work a clear release gate: each provider must pass the same conformance tests for the capabilities it declares.

The tradeoff is that Phase 7 must build contract types and tests before adding Moodle or Canvas adapter runtime behavior.

## Alternatives Considered

Moodle-first contract:

- rejected because Moodle details would leak into Academy workflows and make Canvas/no-LMS parity harder

Canvas-first contract:

- rejected because Canvas details would overfit the contract to an enterprise LMS and weaken smaller-school/no-LMS operation

Adapter-specific Academy branches:

- rejected because they duplicate sync, audit, retry, launch, and reconciliation behavior while increasing provider-secret leakage risk

Provider-neutral contract with capability matrix:

- accepted because it supports Moodle, Canvas, no-LMS, and future providers while preserving Academy as the SIS authority

## Review Notes

- Product boundary: Academy owns SIS records, official records, release decisions, and Student PWA display.
- LMS boundary: providers own delivery runtime behavior through adapters.
- Security/privacy: provider secrets, raw payloads, webhook signatures, and tokens must stay out of Academy domain and PWA read models.
- Testing: implementation must start with provider-neutral contract tests, including no-LMS unsupported outcomes, capability checks, idempotency, deduplication, safe launch response shape, and provider-secret exclusion.
- Rollback: this sprint changes docs only; future code should be additive under a dedicated LMS contract module.
