# Incident Response Runbook

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`

## Purpose

Use this runbook for security, privacy, data integrity, availability, or provider incidents during controlled pilot operation.

## Severity

| Severity | Criteria | Target action |
| --- | --- | --- |
| SEV-1 | Cross-tenant data exposure, credential leak, official-record corruption, payment/aid data exposure, or active compromise | Immediate containment and owner notification |
| SEV-2 | Major workflow outage, failed migrations, unavailable login, transcript/billing/aid processing blocked | Same-day mitigation |
| SEV-3 | Isolated route error, degraded provider integration, non-sensitive reporting issue | Next business-day mitigation |
| SEV-4 | Documentation issue, cosmetic problem, low-risk workflow friction | Planned fix |

## First Response

1. Declare severity and incident owner.
2. Preserve logs, deployment SHA, migration state, request IDs, audit/event rows, and screenshots.
3. Stop or reduce affected traffic when data exposure or corruption is possible.
4. Disable provider workers or feature flags if the incident is provider-specific.
5. Do not delete evidence.

## Containment Playbooks

Authentication or tenant isolation:

- disable affected account links or role assignments;
- rotate Supabase keys if exposed;
- review `academy_account_links`, `academy_person_role_assignments`, and audit events;
- verify protected routes return 401/403 for affected identities.

Database migration failure:

- stop deployment rollout;
- preserve migration output;
- inspect `public.schema_migrations`;
- create a forward repair migration;
- rerun migration rehearsal.

Official-record integrity:

- freeze affected transcript, grade, billing, aid, or communication workflow;
- preserve immutable event and ledger rows;
- create corrective forward events instead of deleting records;
- notify institutional owner before release.

Provider incident:

- disable provider activation or worker execution;
- preserve provider request IDs without storing raw secrets;
- switch impacted workflow to manual/review mode;
- follow provider activation rollback steps once available.

## Communication

Internal incident note must include:

- severity;
- start time;
- affected tenants;
- affected roles/workflows;
- current containment;
- known data exposure status;
- next update time.

External tenant communication must be factual and approved by the incident owner. Do not speculate about exposure or root cause before evidence review.

## Recovery

1. Apply code rollback or forward fix.
2. Apply database forward repair when required.
3. Rotate exposed credentials.
4. Re-run:

```bash
npm test
npm run lint
npm run build
npm run verify:migration-seed-rehearsal
```

5. Re-run role-matrix checks for affected routes.
6. Confirm monitoring returns to baseline.

## Post-Incident Review

Within two business days, record:

- timeline;
- root cause;
- blast radius;
- data exposure conclusion;
- customer/tenant impact;
- corrective actions;
- tests/runbooks added;
- owner and due date.
