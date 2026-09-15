# Deployment Operations Readiness Design

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`  
Factory: `docs/software-factory.md`

## Factory Intake

ADR-0038 Prompt 3 requires controlled-pilot deployment operations runbooks before ChurchCore Academy can be positioned as deployment-ready.

## Problem

The application now has acceptance and migration rehearsal evidence, but production-like operation needs written procedures for environment variables, Supabase migrations, Vercel-compatible deployment, monitoring, incident response, rollback, and backup/restore.

## Decision

Add three runbooks:

- `docs/runbooks/deployment-operations.md`
- `docs/runbooks/incident-response.md`
- `docs/runbooks/backup-restore.md`

The runbooks define controlled-pilot procedures without embedding secrets or claiming provider activation. Provider-specific payment, email/SMS, LMS, and regulated-aid activation remains ADR-0038 Prompt 4.

## Environment Boundary

`.env.example` is the canonical variable inventory. Deployment systems must configure real values through secret managers or platform environment settings, not committed files.

Required baseline:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

Restricted or optional:

- `ANTHROPIC_API_KEY`
- `ACADEMY_LOCAL_BOOTSTRAP_ENABLED`
- `DEMO_MODE_ENABLED`
- `NEXT_PUBLIC_DEMO_MODE_ENABLED`
- `NEXT_PUBLIC_DEMO_VERSION`
- `MOODLE_LAUNCH_BASE_URL`
- `MOODLE_LAUNCH_MODE`
- `CANVAS_LAUNCH_BASE_URL`
- `CANVAS_LAUNCH_MODE`

## Deployment Gate

A controlled-pilot deployment is allowed only after:

1. PR is merged to `main`.
2. CI passes `npm test`, `npm run lint`, and `npm run build`.
3. Supabase migration rehearsal passes.
4. Environment variables are configured in the deployment platform.
5. Backup/restore and incident runbooks have an assigned owner.
6. Provider activation remains disabled unless Prompt 4 checklists are complete.

## Rollback Boundary

Code rollback uses Git/Vercel redeploy to a previous known-good commit. Database rollback uses forward recovery; committed migrations that contain immutable events, audit ledgers, or official records must not be reversed destructively.

## Verification

- docs review for required runbook sections;
- no populated secrets committed;
- `npm test`;
- `npm run lint`;
- `npm run build`.
