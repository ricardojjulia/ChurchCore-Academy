# Transcript Operations Runbook

Date: 2026-06-21
Owner: Registrar / Academic Operations
Related ADR: ADR-0034 Transcript Request And Issuance Workflow

## Purpose

Operate the ChurchCore Academy transcript workflow from student request through registrar action. This runbook covers the current MVP workflow and identifies deferred operational work.

## Supported States

- `requested`: request received from student self-service or staff.
- `held`: registrar has paused fulfillment.
- `issued`: registrar issued the transcript.
- `released`: registrar released a held or issued transcript.
- `revoked`: registrar invalidated the request or issuance.

## Student Request

1. Student opens `/student/documents`.
2. Student selects `Request transcript`.
3. The API resolves the verified actor and creates a transcript request for that actor's person ID.
4. The request is idempotent and tenant-scoped.

Expected result: `academy_transcript_issuances.status = 'requested'` and one `academy_transcript_events` row with `event_type = 'requested'`.

## Registrar Issuance

1. Registrar opens `/admin/transcripts`.
2. Registrar selects a student and delivery method.
3. The UI sends `action=issue` with an idempotency key.
4. `TranscriptService` verifies:
   - actor has registrar-equivalent authority;
   - posted transcript records exist;
   - records are released to the student;
   - no active transcript hold exists.
5. Repository creates the issuance and immutable event.

Expected result: `academy_transcript_issuances.status = 'issued'` and one `academy_transcript_events` row with `event_type = 'issued'`.

## Holds And Release

Use the transition endpoints for operational holds:

- `POST /api/academy/transcripts/{id}/hold`
- `POST /api/academy/transcripts/{id}/release`
- `POST /api/academy/transcripts/{id}/revoke`

Payload:

```json
{ "reason": "Balance due." }
```

Only registrar-equivalent roles can transition transcript records. Every transition writes an immutable event with the previous and new status.

## Export Rule

Official transcript export helpers include only gradebook records where:

- `postingStatus = 'posted'`;
- `releasedToStudentAt` is present.

Draft, pending, held, unreleased, or revoked records are excluded.

## Troubleshooting

- `Idempotency-Key is required.`: client must send the header or body key for mutation routes.
- `Posted transcript records are required before transcript issuance.`: registrar must post and release transcript-grade records before issuing.
- `Transcript hold must be released before issuance.`: release the active transcript hold before issuing another transcript.
- `Students can request only their own transcripts.`: request subject does not match the verified student actor.
- `Forbidden transcript administration access.`: actor lacks registrar-equivalent role.

## Deferred Work

- Certified PDF rendering and seal/signature controls.
- External delivery provider integration.
- Shared institutional hold service with billing and financial aid.
- Transcript notification templates.
- Registrar queue dashboard and reporting exports.
