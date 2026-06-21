# Controlled Pilot Release Notes

Date: 2026-06-21  
Release decision: **split**  
Governing review: `docs/reviews/2026-06-21-council-review-9-release-closeout.md`  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`

## Summary

ChurchCore Academy is approved as a **controlled-pilot candidate for core SIS workflows** with provider activation disabled unless separately approved.

This is not a general-availability release and not a blanket production official-record approval.

## Included In Controlled Pilot

- verified-session authentication and tenant identity resolution;
- forced RLS and request-scoped database context;
- admissions application, review, decision, and conversion;
- registration and enrollment confirmation;
- attendance and grade posting foundation;
- transcript request, issuance, hold, release, revoke, and export filtering;
- billing ledger and manual payment/account workflows;
- institutional financial-aid foundation with regulated-aid gate;
- reporting dashboard and CSV exports;
- persisted communications queue and in-app message centers;
- Student PWA routes for courses, schedule, progress, documents, account, aid, messages, LMS launch, attendance, and privacy;
- Moodle/Canvas/no-LMS provider-neutral contracts and executable worker boundary;
- role-matrix acceptance inventory;
- authenticated role walkthrough harness and seeded acceptance personas;
- migration/seed rehearsal gate;
- deployment, incident, backup/restore, and provider activation runbooks.

## Explicitly Excluded

- general availability;
- unrestricted production official-record use;
- live payment checkout and settlement;
- live email/SMS provider workers;
- live Moodle/Canvas HTTP clients with production tenant credentials;
- regulated/federal aid activation;
- autonomous AI academic or pastoral decisions.

## Required Operator Checks

Before onboarding a controlled-pilot tenant:

```bash
npm run db:migrate:local
npm run db:seed:local
npm run verify:migration-seed-rehearsal
npm test
npm run lint
npm run build
```

Then execute:

- `docs/acceptance/role-matrix-checklist.md`
- `docs/runbooks/deployment-operations.md`
- `docs/runbooks/incident-response.md`
- `docs/runbooks/backup-restore.md`
- `docs/runbooks/provider-activation.md` only for providers being activated

## Known Risks

- Provider activation remains a separate gate.
- Production observability needs implementation beyond runbook coverage.
- Authenticated browser walkthrough screenshots and console-error checks should be repeated per pilot tenant using `docs/acceptance/authenticated-role-walkthrough-evidence.md`.
- Regulated aid requires legal/compliance owner approval.

## Rollback

Code rollback uses the last known-good deployment. Database rollback uses forward recovery migrations and corrective events. Do not destructively reverse immutable audit, transcript, billing, aid, or communication evidence.
