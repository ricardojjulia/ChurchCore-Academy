# ADR-0034 — Transcript Request And Issuance Workflow

**Date:** 2026-06-21  
**Status:** Accepted  
**Deciders:** Council Review VII follow-on implementation

## Context

ChurchCore Academy had transcript tables, a basic admin issuance form, and a revoke endpoint, but it did not support a complete SIS transcript workflow:

- students could not request official transcripts from the Student PWA;
- registrar issuance bypassed an explicit service policy;
- holds, release, revoke, and audit events were incomplete;
- the admin form passed student profile IDs to a repository that expects person IDs;
- official transcript export behavior was not isolated from unreleased or held records.

That left the transcript workflow below competitive SIS expectations even though screens existed.

## Decision

Adopt a stateful transcript workflow:

- `requested`: student or registrar has created a transcript request.
- `held`: registrar blocks fulfillment until the stated hold is cleared.
- `issued`: registrar issues an official transcript after posted, released transcript records exist.
- `released`: registrar releases a held or issued transcript after review.
- `revoked`: registrar invalidates a transcript request or issuance.

All state changes must run through `TranscriptService`, use verified Academy actor identity, and write immutable `academy_transcript_events` rows. Student actors may request and read only their own transcript records. Registrar-equivalent roles may administer transcript state transitions.

Official export routines must include only posted gradebook records that were released to the student. Held, draft, pending, unreleased, and revoked records are excluded.

## Consequences

- Transcript operations become transactional and auditable instead of screen-only.
- Student PWA documents gains a real transcript request action.
- Admin transcript issuance uses student person IDs, avoiding the previous profile/person ID mismatch.
- Future PDF/certified delivery can build on the same state machine and audit trail.
- Billing and financial holds remain future domains; this slice stores transcript holds directly until shared holds are introduced.

## Rejected Alternatives

- **Keep issuance-only API:** rejected because it cannot represent student request intake, holds, or release review.
- **Generate transcript documents directly from the UI:** rejected because it would bypass registrar policy and audit.
- **Add PDF generation in this slice:** rejected because official workflow integrity is the blocker; PDF rendering belongs in the later reporting/export hardening slice.
