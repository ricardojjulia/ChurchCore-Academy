# ADR 0007: Provider-Neutral LMS Course Shell Mapping

Date: 2026-06-02
Status: accepted

## Context

ChurchCore Academy may integrate with Moodle, Canvas, another LMS, or no LMS.

The Academy course catalog must remain the SIS system of record. If course and section records become shadows of Moodle or Canvas course shells, no-LMS mode becomes weak, provider migration becomes difficult, and Academy business logic becomes coupled to provider runtime behavior.

Course shell mapping will affect future provisioning, roster sync, enrollment sync, grade return, progress return, reconciliation, and student PWA LMS launch.

## Decision

ChurchCore Academy will keep course and section records provider-neutral.

Future course records may reference `CourseLmsMapping` records with:

- `provider`
- `mappingStatus`
- `externalCourseKey`
- `externalSectionKey`
- `syncPolicy`
- `lastReviewedAt`

The mapping record is a provider-neutral reference only. Provider-specific credentials, OAuth tokens, API URLs, sync attempts, retry queues, webhook payloads, provider errors, and LMS activity metrics belong in the future LMS integration contract and adapter layer, not in the course catalog domain.

## Consequences

This supports:

- no-LMS institutions
- Moodle-first deployments
- Canvas deployments
- future provider selection by tenant
- provider migration without rewriting Academy course records
- course setup review before provisioning

The tradeoff is that course setup UI and validation must distinguish "course exists in Academy" from "LMS shell is provisioned." Future adapters must reconcile mappings instead of assuming every section has a provider shell.

## Alternatives Considered

LMS-first course shell model:

- rejected because it couples Academy records to Moodle or Canvas and breaks no-LMS mode

Store provider-specific fields directly on course and section records:

- rejected because it mixes SIS records with adapter runtime state and provider secrets

Provider-neutral mapping reference:

- accepted because it preserves Academy ownership while giving future adapters stable mapping handles

## Review Notes

- Product boundary: Academy owns catalog courses, sections, and mapping readiness as SIS records.
- LMS boundary: Moodle, Canvas, and other providers own delivery runtime behavior through adapters.
- Security/privacy: provider secrets, tokens, webhook payloads, and LMS activity data must not be stored in course catalog records.
- Testing: future implementation must test no-LMS, Moodle-planned, Canvas-planned, ready-to-provision, mapped, and needs-review states.
- Rollback: this sprint changes docs only; future schema work must be reversible through migrations.
