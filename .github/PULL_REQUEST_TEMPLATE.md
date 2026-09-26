## Summary

Describe the problem and the reviewable outcome.

## Changes

- Describe the focused implementation changes.

## Product and Architecture Boundaries

- [ ] Academy remains the academic system of record.
- [ ] LMS-specific behavior stays behind provider contracts.
- [ ] Tenant, role, student, guardian, and record visibility are addressed.
- [ ] ShepherdAI or LLIS behavior remains explainable, consent-aware, and human-reviewed where relevant.

## Database and Operations

- [ ] No schema or operational changes.
- [ ] Migrations include constraints, indexes, grants, RLS, and rollback/forward considerations.
- [ ] Secrets and private data are excluded.

## Council / Factory

- [ ] `docs/development-guide.md` was followed for current MVP/competitive objective, Council, Testing Council, factory, and verification posture.
- [ ] Council required and completed, or explicitly not required because this is trivial.
- [ ] Feature-factory story/brief or scoped plan is linked for non-trivial work.
- [ ] Testing Council surface reviewed for pages, APIs, journeys, personas, known issues, and denied-role/cross-tenant coverage.
- [ ] Documenter close-out completed for docs, changelog, ADRs, and run records that changed.
- [ ] `pr-review` gate completed and Critical/Important findings are resolved or explicitly deferred with owner and issue.

## Test Surface (required for user-facing changes — docs/testing/e2e-suite.md)

- [ ] New pages / API methods are registered in `e2e/surfaces/manifest.ts` with their access list.
- [ ] New workflows have a journey spec in `e2e/journeys/` (including a denied-role or cross-tenant check).
- [ ] New roles have a persona in `e2e/personas.ts`.
- [ ] Bugs fixed here are removed from `e2e/surfaces/known-issues.ts`.
- [ ] `npm run test:full` passes locally for auth, routing, or new-surface changes.

## Verification

```text
npm run verify:governance
npm test
npm run lint
npm run build
npm run test:full
git diff --check
```

Add focused database, API, and browser checks:

```text

```

## Evidence

Include screenshots for visible UI changes and note any remaining limitations.
