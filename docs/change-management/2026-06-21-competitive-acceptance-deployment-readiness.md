# Competitive Acceptance And Deployment Readiness Change Management

**Date:** 2026-06-21  
**Change type:** Release governance, deployment readiness, final acceptance gate  
**Source:** Council Review VIII  
**Status:** Approved for factory execution.  

## Change Summary

ChurchCore Academy has completed the major ADR-0033 pre-production workflow slices. The next change is not another feature sprint; it is a release-readiness program that proves whether the product can enter controlled pilot deployment.

## Affected Areas

- All primary route families and role surfaces
- Supabase Auth and Postgres deployment
- migrations and seed data
- Vercel or deployment runtime configuration
- payment-provider activation
- email/SMS-provider activation
- Moodle and Canvas provider clients
- regulated aid activation
- support, backup, monitoring, and incident procedures
- README, roadmap, project status, release notes, and onboarding docs

## Change Control Rules

1. No production or GA claim until ADR-0038 acceptance is complete.
2. Controlled pilot may be approved only after role-matrix, migration, deployment, and provider-boundary evidence are recorded.
3. Live provider credentials must be configured through environment/secret management, not committed files.
4. Payment, email/SMS, LMS, and regulated-aid activation are separate gates.
5. Failed acceptance checks must create explicit remediation tasks or split decisions.
6. Release notes must distinguish implemented foundations from live activated services.

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Claiming production readiness before acceptance evidence | Critical | ADR-0038 requires final council closeout. |
| Browser/role-matrix gaps hiding broken routes | High | Run role-by-role acceptance checklist. |
| Provider secrets leakage | High | Use secret management and safe payload tests. |
| Migration drift between local and deployment DB | High | Run migration/seed/live-tenant rehearsal. |
| Regulated aid compliance exposure | Critical | Keep regulated/federal aid disabled until separate activation. |
| Payment settlement mismatch | High | Treat manual payment boundary as foundation until provider checkout is activated. |
| Operational support gaps | Medium | Add backup, incident, rollback, and monitoring runbooks. |

## Acceptance Gates

Required:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Also required:

- route/browser smoke for primary roles;
- migration and seed rehearsal;
- environment variable checklist;
- provider activation checklist;
- security/privacy review;
- final council release decision.
