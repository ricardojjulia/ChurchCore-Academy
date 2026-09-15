# Deployment Operations Runbook

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`

## Purpose

Use this runbook to deploy ChurchCore Academy to a controlled-pilot environment. It covers build, environment configuration, Supabase migration, Vercel-compatible deployment, monitoring, rollback, and secrets handling.

## Release Gate

Deploy only when all conditions are true:

- PR is merged to `main`.
- CI passes `npm test`, `npm run lint`, and `npm run build`.
- `npm run db:migrate:local`, `npm run db:seed:local`, and `npm run verify:migration-seed-rehearsal` have passed for the rehearsal database.
- `docs/runbooks/incident-response.md` and `docs/runbooks/backup-restore.md` have assigned owners.
- Provider activation remains disabled unless `docs/runbooks/provider-activation.md` exists and is complete.

## Environment Variables

Canonical local inventory: `.env.example`.

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server | Yes | Public Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server | Yes | Publishable browser-safe key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes for privileged server operations | Never expose to browser code. |
| `DATABASE_URL` | Server/ops only | Yes | Direct Postgres connection for migrations, seeds, and server repositories. |
| `ANTHROPIC_API_KEY` | Server only | Optional | HQ AI council only; do not expose in client payloads. |
| `ACADEMY_LOCAL_BOOTSTRAP_ENABLED` | Server only | No in deployed environments | Must be `false` outside loopback local development. |
| `DEMO_MODE_ENABLED` | Server only | Optional | Non-production demo feedback only. |
| `NEXT_PUBLIC_DEMO_MODE_ENABLED` | Browser | Optional | Non-production demo feedback UI only. |
| `NEXT_PUBLIC_DEMO_VERSION` | Browser | Optional | Demo label. |
| `MOODLE_LAUNCH_BASE_URL` | Server only | Optional | Activate only through provider checklist. |
| `MOODLE_LAUNCH_MODE` | Server only | Optional | Activate only through provider checklist. |
| `CANVAS_LAUNCH_BASE_URL` | Server only | Optional | Activate only through provider checklist. |
| `CANVAS_LAUNCH_MODE` | Server only | Optional | Activate only through provider checklist. |

## Secret Handling

- Configure secrets in the hosting platform or secret manager.
- Do not commit `.env.local`, copied production env files, exported dashboards, or provider credentials.
- Never prefix server-only secrets with `NEXT_PUBLIC_`.
- Rotate secrets after any accidental disclosure or unauthorized access suspicion.
- Treat service-role keys, database URLs, LMS tokens, payment secrets, email/SMS credentials, and AI provider keys as high-risk secrets.

## Supabase Migration Procedure

1. Confirm the target database and environment name.
2. Confirm the latest merged commit is deployed or ready to deploy.
3. Run rehearsal against the intended non-production database first:

```bash
npm run db:migrate:local
npm run db:seed:local
npm run verify:migration-seed-rehearsal
```

4. For hosted Supabase, apply the same committed migrations through the approved deployment mechanism for that environment.
5. Verify migration tracking after apply.
6. Do not edit committed migrations after they have been applied to a shared database. Use forward repair migrations.

## Build And Deployment

Local production build:

```bash
npm run build
```

Vercel-compatible deployment procedure:

1. Confirm `main` is green in CI.
2. Confirm environment variables are present in the target project.
3. Deploy the merged `main` commit through the configured Vercel project or CI pipeline.
4. Confirm the deployment uses the intended commit SHA.
5. Run unauthenticated protected-route smoke:

```bash
curl -I https://<deployment-host>/admin
curl -I https://<deployment-host>/student
curl -I https://<deployment-host>/platform/control
```

Expected result: redirect to `/login?next=...`.

6. Sign in with controlled-pilot test accounts and verify admin, faculty, student, guardian, finance, admissions, registrar, and platform admin surfaces according to `docs/acceptance/role-matrix-checklist.md`.
7. Confirm structured operational events are visible in the deployment log sink according to `docs/runbooks/observability.md`.

## Monitoring Checklist

During and after deployment, monitor:

- failed logins and authentication errors;
- 401/403 spikes by route;
- 500 responses and unhandled exceptions;
- database connection exhaustion;
- slow queries on admissions, registration, gradebook, billing, aid, transcripts, reporting, and communications;
- migration failures;
- provider worker failures after provider activation;
- audit/event table write failures.

Structured event categories and redaction rules are defined in `docs/runbooks/observability.md`.

## Rollback

Code rollback:

1. Identify the last known-good commit.
2. Redeploy the last known-good deployment or revert through Git and deploy the revert commit.
3. Re-run protected-route smoke and critical role checks.

Database rollback:

- Use forward recovery migrations.
- Do not destructively delete official records, immutable audit rows, ledger rows, transcript events, or communication audit evidence.
- If a migration partially applied, preserve evidence and create an idempotent repair migration.

## Deployment Record

For every controlled-pilot deployment, record:

- date and time;
- commit SHA;
- environment;
- migration range applied;
- verification commands;
- smoke results;
- operator;
- open risks;
- rollback target.
