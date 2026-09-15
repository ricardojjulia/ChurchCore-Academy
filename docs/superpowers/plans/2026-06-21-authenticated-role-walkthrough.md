# Authenticated Role Walkthrough Harness Plan

Spec: `docs/superpowers/specs/2026-06-21-authenticated-role-walkthrough-design.md`  
Governing review: `docs/reviews/2026-06-21-council-review-9-release-closeout.md`

## Scope

Implement the first Council Review IX deferred prompt: authenticated browser walkthrough evidence for the controlled-pilot role matrix.

## Tasks

- [x] Add pure role acceptance personas for tenant admin, registrar, faculty, guardian, finance, and admissions.
- [x] Preserve `admin@churchcore.academy` as the platform-admin walkthrough persona.
- [x] Add a role walkthrough module derived from the ADR-0038 role matrix.
- [x] Add `npm run verify:role-walkthrough` to generate evidence markdown.
- [x] Generate `docs/acceptance/authenticated-role-walkthrough-evidence.md`.
- [x] Add tests for walkthrough generation, migration coverage, and finance local bootstrap.
- [x] Update runbooks, project status, and roadmap.
- [ ] Execute live browser screenshots for the target pilot tenant after migrations and seed are applied in that environment.

## Verification

Required before merge:

```bash
node --import tsx --test src/modules/acceptance/__tests__/authenticated-role-walkthrough.test.ts src/modules/academy-auth/__tests__/policy.test.ts src/modules/academy-auth/__tests__/demo-persona-migration.test.ts
npm run verify:role-walkthrough
npm test
npm run lint
npm run build
git diff --check
```

## Remaining Pilot Evidence

The generated artifact is the harness and template. Pilot closeout still requires captured screenshot paths, console-error checks, and observed route results for the actual tenant and browser session.
