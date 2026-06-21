# Financial Aid Operations Runbook

Date: 2026-06-21
Applies to: Slice 5 Financial Aid Foundation

## Supported Workflow

1. Open `/admin/financial-aid`.
2. Create an aid package for the student and aid year.
3. Create an institutional award against that package.
4. Accept the award when the institution approves it.
5. Schedule a disbursement.
6. Post the scheduled disbursement to the student account ledger.
7. Confirm the student can see the award and disbursement at `/student/aid`.
8. Confirm the ledger credit appears in billing/student account views.

## Controls

- Use only institutional, denominational, mission, or church aid sources.
- Do not use this workflow for federal, Title IV, state grant, or loan aid.
- Use holds for missing documentation or internal review requirements.
- Do not delete ledger entries; post reversing entries in a future correction workflow.
- Treat student aid records as financial records and avoid exporting them outside approved reporting paths.

## Regulated Aid Boundary

Federal and Title IV workflows are disabled by ADR-0036. Activation requires a separate compliance gate covering SAP, refund/return calculations, regulatory exports, document retention, and institution-specific eligibility.

## Operational Checks

- Aid package exists for the correct student and aid year.
- Award amount and description match the institutional approval.
- Award status is accepted before posting disbursement.
- Disbursement idempotency key is unique to the workflow action.
- Posted disbursement has a linked billing ledger entry.
- Student aid page shows only the signed-in student's records.

## Verification Commands

```bash
node --import tsx --test src/modules/financial-aid/__tests__/service.test.ts src/modules/financial-aid/__tests__/migration.test.ts src/app/api/academy/financial-aid/__tests__/route.test.ts
npx tsc --noEmit
npm run db:migrate:local
npm test
npm run lint
npm run build
```
