# ADR 0015: Moodle Adapter Integration Model

Date: 2026-06-04
Status: accepted

## Context

ChurchCore Academy supports Moodle, Canvas, and no-LMS operation through a provider-neutral LMS contract. Phase 7 established contract types, no-LMS behavior, tenant provider selection, audit helpers, idempotency foundations, and reconciliation summaries.

Moodle is the first external provider target. Moodle exposes Web Services and an External API for external systems, and Moodle deployments may also support OIDC and LTI Advantage launch flows. The adapter must use these Moodle capabilities without making Moodle the source of truth for Academy SIS records.

## Decision

ChurchCore Academy will implement Moodle as an adapter behind the existing provider-neutral LMS contract.

The Moodle adapter will use Moodle Web Services only for server-to-server sync families such as course shell provisioning, roster sync, enrollment sync, grade/progress import, and reconciliation. Student launch will be handled through a separate configured launch mechanism, such as OIDC or LTI where supported, and will return only the provider-neutral `LmsLaunchResponse` shape.

Moodle tokens, endpoint URLs, OIDC secrets, LTI keys, raw Moodle payloads, retry state, and Moodle runtime errors belong in the future Moodle provider configuration/secret and adapter runtime layer. They must not be stored in Academy course catalog, people, grading, official-record, Student PWA, or ShepherdAI records.

Grade and progress return from Moodle will enter Academy as reviewed imports. Academy remains authoritative for official records, release decisions, transcript holds, guardian visibility, standing, promotion, graduation readiness, and Student PWA display.

## Consequences

This keeps the Academy/Moodle boundary consistent with the provider-neutral contract and no-LMS mode.

It also lets the Moodle adapter use Moodle's strengths without exposing Web Service tokens or Moodle internals to students.

The tradeoff is operational complexity: Moodle setup must document Web Services, selected functions, capabilities, service users/tokens, and launch configuration separately.

## Alternatives Considered

Moodle REST adapter only:

- rejected for launch because Web Service tokens are not safe Student PWA launch artifacts
- accepted for future server-to-server sync families

LTI-first adapter:

- rejected as the whole adapter model because Academy needs course/roster/grade synchronization and Moodle deployment support may vary
- retained as a launch/content option where deployment supports it

OIDC launch plus Web Services sync:

- accepted because it separates browser launch from server-to-server sync credentials and preserves the provider-neutral contract

Moodle-as-source-of-truth:

- rejected because it violates Academy's SIS boundary and weakens no-LMS and Canvas parity

## Review Notes

- Product boundary: Academy owns SIS records and release decisions.
- LMS boundary: Moodle owns delivery runtime behavior through the adapter.
- Security/privacy: Moodle tokens, endpoint URLs, OIDC secrets, LTI keys, raw payloads, and provider errors must stay out of Student PWA and Academy domain records.
- Testing: implementation must start with mocked Moodle contract conformance tests before live Moodle calls.
- Rollback: this sprint changes docs only; future runtime code should be additive and isolated under the LMS contract/provider layer.
