# Deployment Record

Date/time:
Environment:
Operator:
Commit SHA:
PR:

## Pre-Deployment Gate

- [ ] PR merged to `main`.
- [ ] CI `Test, lint, and build` passed on the merged commit.
- [ ] E2E required status passed on the merged commit.
- [ ] Required migration rehearsal completed or marked not applicable.
- [ ] Environment variables reviewed against `.env.example`.
- [ ] Rollback target identified.

## Migration Evidence

Migration range:
Rehearsal commands/results:
Hosted Supabase apply mechanism:
Forward-repair or rollback notes:

## Deployment Evidence

Vercel deployment URL:
Target commit verified: yes/no
Deployment status:

## Smoke Checks

| Check | Expected | Actual |
| --- | --- | --- |
| `/admin` unauthenticated | redirect to login |  |
| `/student` unauthenticated | redirect to login |  |
| `/platform/control` unauthenticated | redirect to login |  |
| Role walkthrough | expected role surfaces load/deny |  |
| Logs/observability | no unexpected auth/500 spikes |  |

## Decision

Release decision: proceed / rollback / hold
Open risks:
Follow-up:
