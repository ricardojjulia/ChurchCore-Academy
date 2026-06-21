# Provider Activation Runbook

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`

## Purpose

Use this runbook before enabling any live external provider for a controlled-pilot tenant.

Provider activation is a release gate, not a configuration shortcut. If evidence is missing, keep the provider disabled or in manual/review mode.

## Universal Activation Rules

Before activation:

- tenant owner approves the provider and scope;
- sandbox evidence is recorded;
- production credentials are configured only in the secret layer;
- provider-safe payload tests pass;
- no raw provider secrets are returned to browsers, audit payloads, logs, Student PWA read models, or communication templates;
- rollback/manual-mode procedure is documented;
- activation owner and support contact are named.

## Payment Checkout And Settlement

Status before activation: blocked unless a payment provider implementation and webhook workflow are approved.

Required secrets:

- payment provider secret key;
- webhook signing secret;
- publishable/client key only if a client checkout is implemented;
- sandbox and production account identifiers.

Sandbox evidence:

- create payment intent for the authenticated student or finance role;
- verify idempotency key replay;
- complete sandbox checkout;
- receive and verify webhook signature;
- post settlement or manual payment to `academy_billing_ledger_entries`;
- prove provider client secret is redacted in returned payloads.

Production evidence:

- production account verified;
- webhook endpoint configured;
- small live test transaction approved by tenant owner;
- refund/void path documented;
- finance operator trained on reconciliation.

Rollback:

- disable checkout entry points;
- keep manual payment posting enabled for finance role;
- mark outstanding provider intents as review-required;
- preserve ledger rows and provider references;
- rotate compromised payment secrets.

## Email And SMS Delivery

Status before activation: blocked unless provider worker and deliverability evidence are approved.

Required secrets:

- email provider API key;
- SMS provider API key or token;
- webhook signing secret for delivery/failure callbacks;
- verified sending domain or phone number.

Sandbox evidence:

- send in-app only message;
- send sandbox email message;
- send sandbox SMS if SMS is enabled;
- verify opt-out suppression;
- verify essential message override rules;
- verify provider failure records retry metadata without raw provider payloads;
- verify template variables reject secrets, tokens, passwords, and raw provider payloads.

Production evidence:

- sending domain verified;
- bounce/failure webhook configured;
- suppression/opt-out process confirmed;
- tenant communication owner approved templates;
- delivery monitoring dashboard or log query defined.

Rollback:

- disable provider worker;
- continue in-app messages;
- mark queued email/SMS as provider paused;
- preserve message and audit events;
- rotate exposed provider credentials.

## Moodle Live HTTP Client

Status before activation: blocked unless tenant Moodle credentials and live client evidence are approved.

Required secrets:

- Moodle base URL;
- Web Services token or OAuth/OIDC credentials;
- LTI keys if LTI launch is used;
- webhook secret if Moodle event callbacks are enabled.

Sandbox evidence:

- resolve tenant provider selection as active Moodle;
- create course shell operation plan;
- sync roster for teacher and student roles;
- return grade/progress imports into reviewed-import state;
- run reconciliation and review mapping drift;
- verify Student PWA launch response does not expose tokens, base internal metadata, or raw provider payloads.

Production evidence:

- Moodle site HTTPS verified;
- plugin/Web Services capability enabled for the approved tenant scope;
- service account permissions restricted;
- first production sync reviewed by registrar and LMS owner;
- reconciliation baseline recorded.

Rollback:

- pause tenant Moodle provider status;
- stop live HTTP worker execution;
- keep Academy as SIS source of truth;
- require manual reconciliation before reactivation;
- rotate Moodle service credentials when compromise is suspected.

## Canvas Live HTTP Client

Status before activation: blocked unless tenant Canvas credentials and live client evidence are approved.

Required secrets:

- Canvas base URL;
- API token or OAuth client credentials;
- LTI keys if LTI launch is used;
- webhook secret if Canvas events are enabled.

Sandbox evidence:

- resolve tenant provider selection as active Canvas;
- create course shell operation plan;
- sync roster for teacher/student roles;
- return grade/progress imports into reviewed-import state;
- run reconciliation and review mapping drift;
- verify Student PWA launch response does not expose tokens, client secrets, or raw provider payloads.

Production evidence:

- Canvas domain/account scope verified;
- service account permissions restricted to tenant academic scope;
- first production sync reviewed by registrar and LMS owner;
- reconciliation baseline recorded.

Rollback:

- pause tenant Canvas provider status;
- stop live HTTP worker execution;
- keep Academy as SIS source of truth;
- require manual reconciliation before reactivation;
- rotate Canvas service credentials when compromise is suspected.

## Regulated Or Federal Aid

Status before activation: blocked.

Activation requires:

- legal/compliance owner approval;
- regulatory program eligibility confirmation;
- written data-retention and privacy procedure;
- separation between institutional aid and regulated aid workflows;
- audit plan for award, disbursement, adjustment, and return-of-funds events;
- tenant owner sign-off.

Sandbox or pre-production evidence:

- create non-federal institutional aid package;
- confirm federal aid award types remain blocked until compliance gate opens;
- verify student self-view only exposes their own aid;
- verify finance role can administer aid without exposing unrelated student records.

Production evidence:

- compliance owner approval recorded;
- provider or agency credential storage approved;
- reporting and audit obligations documented;
- rollback/manual correction process approved.

Rollback:

- disable regulated-aid award types;
- preserve existing institutional aid records;
- use forward corrective events for posted disbursements;
- notify compliance owner before any tenant-facing communication.

## Activation Record Template

```markdown
Provider:
Tenant:
Environment:
Activation owner:
Tenant owner approval:
Sandbox evidence:
Production evidence:
Secrets configured by:
Rollback tested:
Open risks:
Activation decision: approve | defer | split
Date:
```

## Required Verification

```bash
node --import tsx --test src/modules/billing/__tests__/service.test.ts src/modules/communications/__tests__/service.test.ts src/modules/lms-contract/__tests__/*.test.ts
npm test
npm run lint
npm run build
```
