# Academy OneRoster exchange

## Intake and authority

On 2026-09-17 the owner explicitly authorized a separate Academy implementation and pull request. Continue the approved 2026-09-12 certification-ready compliance plan. Academy owns roster export; LMS owns learning delivery and reviewed roster import. The earlier revert corrected an unauthorized repository publication, not the provider role. This implementation must use its own Academy branch and PR.

## Discovery and options

Main d1ab438 has the provider-neutral roster preview but no OneRoster exporter. The exporter at 94dfdde was reverted. LMS has a signed inbound staging endpoint. Options considered: restore the old commit wholesale; expose a new provider-neutral feed and move transformation to LMS; selectively recover the exporter and adapt it to current authentication, privacy and conformance requirements. Choose selective recovery, as the approved plan explicitly assigns CSV generation to Academy and requires manual download before scheduled delivery.

## Design and review decisions

- Export persisted people, academic structure and registrations through repositories under the verified actor's database context. Authorize institution administrators before any reads. Never create Auth users or mutate academic records.
- Produce the approved 1.2.1 roster subset as delta CSV ZIP. Export only required identity and roster fields; exclude phone, guardians, demographics and credentials.
- Keep a tenant-scoped, explicit academic context for export. Do not silently represent a partial export as a whole-tenant bulk snapshot.
- Provide manual admin download first. Prove golden-fixture parity and real persisted Academy export through LMS validation before enabling transport.
- Signed delivery uses the existing LMS Ed25519 message format, connection identifier, UUID delivery identifier, timestamp and package digest. Deployment secrets remain server-only; receipt stages for human review. No automatic apply.
- Standalone mode performs no outbound work. Production activation remains a separate operator decision after local evidence.

## Verification and delivery

Use Node test runner, lint and production build; verify negative role and tenant cases, secret/PII exclusion, real module-created prerequisites, ZIP download in a browser, LMS parsing and signed delivery/replay behavior. Record actual evidence separately from planned work. Ship through the explicitly authorized Academy PR with the owner as approver. Do not merge or enable production exchange merely because checks pass.
