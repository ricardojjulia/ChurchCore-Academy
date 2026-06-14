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

## Verification

```text
npm test
npm run lint
npm run build
git diff --check
```

Add focused database, API, and browser checks:

```text

```

## Evidence

Include screenshots for visible UI changes and note any remaining limitations.
