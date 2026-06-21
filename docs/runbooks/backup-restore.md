# Backup Restore Runbook

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`

## Purpose

Use this runbook to define backup and restore expectations for controlled-pilot ChurchCore Academy deployments.

## Backup Scope

Back up:

- Supabase Postgres database;
- Auth users and identities required to resolve Academy account links;
- storage buckets if enabled in a later slice;
- environment variable inventory without secret values;
- deployment commit SHA and migration history.

Do not treat local seed data as a production backup.

## Backup Schedule

Controlled pilot minimum:

- daily automated database backup;
- backup before any migration window;
- backup before provider activation;
- export migration history after each deployment.

Production official-record operation will require a stricter retention schedule and restore-time objective before approval.

## Restore Rehearsal

At least once before pilot launch:

1. Provision an isolated restore database.
2. Restore the latest backup.
3. Point a non-production deployment or local environment at the restored database.
4. Run:

```bash
npm run verify:migration-seed-rehearsal
npm test
npm run build
```

5. Verify representative role access for admin, registrar, faculty, student, guardian, finance, admissions, and platform admin.
6. Record elapsed restore time, data timestamp, verification results, and gaps.

## Restore Validation

Validate:

- `public.schema_migrations` matches committed migration history;
- tenant records exist and are scoped correctly;
- account links resolve to expected Auth users;
- RLS policies remain enabled and forced where expected;
- official records, audit events, billing ledgers, aid records, transcript events, and communications are present;
- provider secrets are not restored into client-visible tables or responses.

## Failure Handling

If restore fails:

1. Preserve restore logs and backup identifier.
2. Try the previous backup only after preserving evidence.
3. Do not overwrite the failed target until root cause is captured.
4. Escalate as SEV-1 if official records may be unrecoverable.
5. Add or update tests/runbooks after recovery.

## Destructive Action Guardrail

Never run destructive database reset, truncate, or delete operations against a pilot or production database without:

- written change approval;
- confirmed backup;
- restore target identified;
- owner present;
- rollback/forward recovery plan documented.
