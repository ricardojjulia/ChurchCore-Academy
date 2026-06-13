# ADR 0019: Immutable Audit Events And Outbox Boundary

Date: 2026-06-13
Status: accepted

## Context

Academy needs durable evidence for authentication-sensitive administration, grades, transcripts, payments, financial aid, communications, and LMS operations. External side effects also require retries without duplicating business transactions.

## Decision

Academy will store append-only audit events containing tenant, actor, action, entity references, correlation and idempotency identifiers, result, and redacted metadata. Audit records cannot be updated or deleted through normal application roles.

Later external operations use a transactional outbox written with the domain mutation. Workers deliver provider operations and append outcome audit events.

Raw provider, payment, federal-aid, authorization, or secret payloads are prohibited from audit metadata.

## Consequences

Domain services must identify actor and correlation data at mutation time. Storage grows continuously and needs retention and archival policy. External delivery becomes asynchronous but retryable and observable.

## Alternatives Considered

Application logs only:

- rejected because logs are not tenant-scoped domain evidence and may be mutable or short-lived.

Direct provider calls inside request transactions:

- rejected because network failures create partial completion and duplicate retry risk.

Append-only audit plus transactional outbox:

- accepted because it separates authoritative domain commits from recoverable external delivery.

## Review Notes

- Product boundary: audit records describe Academy operations; provider runtimes remain external.
- Security/privacy: metadata uses allowlists and rejects secret-shaped fields.
- Testing: append-only enforcement, tenant scope, idempotency, and redaction tests are required.
- Rollback: audit records remain preserved; outbox consumers can be paused independently.
