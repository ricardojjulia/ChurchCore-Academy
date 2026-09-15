# Provider Activation Readiness Design

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`  
Factory: `docs/software-factory.md`

## Factory Intake

ADR-0038 Prompt 4 requires activation checklists for live payments, email/SMS, Moodle, Canvas, and regulated aid before controlled pilot release can claim external-provider readiness.

## Problem

ChurchCore Academy has provider-safe workflow foundations, but live provider activation introduces credentials, external accounts, settlement, deliverability, LMS API behavior, and regulated-aid compliance risk. These cannot be handled as ad hoc deployment notes.

## Decision

Add `docs/runbooks/provider-activation.md` as the governing activation checklist for:

- payment checkout and settlement;
- email/SMS delivery workers;
- Moodle live HTTP clients;
- Canvas live HTTP clients;
- regulated/federal aid activation.

The runbook records required secrets, test accounts, sandbox evidence, production evidence, rollback, and explicit blocked states.

## Activation Rule

No provider may be activated for a pilot tenant unless:

1. the tenant owner approves the provider;
2. sandbox evidence is recorded;
3. production credentials are stored only in the secret layer;
4. provider-safe payload tests pass;
5. rollback/manual-mode steps are documented;
6. the provider is marked active only after review.

## Current Code Boundary

Current code supports provider-safe boundaries and normalized LMS worker operations. It does not yet implement every live HTTP client or every payment/email/SMS provider worker. Therefore this slice documents the gate and keeps unactivated providers blocked until implementation and evidence exist.

## Verification

- provider-safe billing payload tests;
- communication secret rejection tests;
- LMS launch/sync/reconciliation secret-redaction tests;
- `npm test`;
- `npm run lint`;
- `npm run build`.
