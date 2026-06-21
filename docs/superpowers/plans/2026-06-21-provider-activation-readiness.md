# Provider Activation Readiness Plan

Date: 2026-06-21  
Spec: `docs/superpowers/specs/2026-06-21-provider-activation-readiness-design.md`  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`

## Objective

Implement ADR-0038 Prompt 4 by adding provider activation checklists for payments, email/SMS, Moodle, Canvas, and regulated aid.

## Tasks

- [x] Read ADR-0038 Prompt 4 and existing provider-safe code/tests.
- [x] Add `docs/runbooks/provider-activation.md`.
- [x] Capture required secrets, test accounts, sandbox evidence, production evidence, and rollback for each provider family.
- [x] Update project status and factory roadmap.
- [x] Run focused provider-safe tests.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Acceptance Criteria

- Payments activation is blocked until checkout, settlement, webhook, idempotency, and rollback evidence are recorded.
- Email/SMS activation is blocked until sandbox delivery, opt-out, bounce/failure, and provider-secret evidence are recorded.
- Moodle activation is blocked until live HTTP client credentials, sandbox sync, reconciliation, and rollback are recorded.
- Canvas activation is blocked until live HTTP client credentials, sandbox sync, reconciliation, and rollback are recorded.
- Regulated/federal aid remains blocked until legal/compliance review, sandbox or program evidence, and operational owner approval are recorded.
- Provider secrets must not appear in browser payloads, logs, audit rows, or committed files.

## Evidence Commands

```bash
node --import tsx --test src/modules/billing/__tests__/service.test.ts src/modules/communications/__tests__/service.test.ts src/modules/lms-contract/__tests__/*.test.ts
npm test
npm run lint
npm run build
git diff --check
```
