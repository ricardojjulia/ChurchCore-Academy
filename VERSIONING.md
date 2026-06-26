# Versioning

ChurchCore Academy uses semantic versioning for development milestones while the product is pre-GA.

Current version: `0.8.0`

## Version Format

```text
MAJOR.MINOR.PATCH
```

## Current Pre-GA Rule

Before general availability:

- `0.x.0` minor releases mark meaningful controlled-pilot milestones, major workflow slices, release-readiness packages, or integration closeouts.
- `0.x.y` patch releases mark focused fixes, documentation cleanup, migration repair, seed repair, or small operational hardening.
- `1.0.0` is reserved for a future general-availability decision and must not be used until the governing council/release review approves broad production readiness.

## Release Classes

### Minor Milestone

Use a minor version when the change adds or closes a significant product capability, for example:

- a complete SIS workflow family;
- release-readiness package;
- controlled-pilot closeout;
- major integration boundary;
- durable operations or security foundation;
- large documentation and governance refresh tied to a release state.

Example:

```text
0.8.0 — Controlled-pilot and full LMS integration closeout documentation refresh.
```

### Patch Release

Use a patch version when the change is focused and does not change the release posture:

- bug fix;
- migration repair;
- seed repair;
- test hardening;
- small UI polish;
- documentation correction;
- package metadata cleanup.

Example:

```text
0.8.1 — Fix local HOWTO command wording and refresh release links.
```

### Major Release

Do not use `1.0.0` until all of the following are true:

- the governing release review approves general availability;
- production provider activation gates are resolved or explicitly excluded from the GA claim;
- security, tenant isolation, migration, observability, backup/restore, and incident-response gates are complete;
- pilot evidence is attached for the required tenant workflows;
- README, HOWTO, CHANGELOG, VERSIONING, release notes, and project status all agree.

## Release Status Language

Use precise status labels:

| Label | Meaning |
| --- | --- |
| `foundation` | Domain model, schema, policy, or non-user-facing capability exists. |
| `working vertical slice` | A user or operator can complete an end-to-end workflow in the app. |
| `controlled-pilot candidate` | Workflow is ready for bounded pilot use under release conditions. |
| `external release gate` | Code work is closed, but live environment evidence or approval is still required. |
| `production activated` | Live provider or production workflow is approved, configured, evidenced, and rollback-reviewed. |
| `general availability` | Broad production release is explicitly approved by the governing review. |

Avoid ambiguous labels such as "done" when a provider or compliance gate remains external.

## Files To Update For A Version Change

For every version bump, update:

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `docs/project-status.md`

When the release posture changes, also update:

- `README.md`
- `HOWTO.md`
- `docs/README.md`
- `docs/product/factory-roadmap.md`
- relevant `docs/releases/*.md`
- relevant `docs/reviews/*.md`
- relevant runbooks or provider guides

## Changelog Rules

`CHANGELOG.md` follows Keep a Changelog style:

- `Added` for new capabilities, routes, modules, docs, tests, runbooks, and scripts.
- `Changed` for behavior, release posture, documentation authority, or workflow changes.
- `Fixed` for defects and stale/wrong documentation.
- `Security` for tenant isolation, RLS, auth, secret-handling, audit, and privacy changes.
- `External Gates` for provider, compliance, or environment evidence that remains outside code.

The changelog must distinguish implementation complete from provider activated.

## Git Tags

Use tags only after verification and review:

```bash
git tag v0.8.0
git push origin v0.8.0
```

Do not tag a release if:

- tests or build fail;
- release notes and changelog disagree;
- provider activation is implied without evidence;
- the working tree is dirty;
- the branch is not intentionally published.

## Verification Before Release

Minimum gate:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Recommended release gate:

```bash
npm run verify:migration-seed-rehearsal
npm run verify:role-walkthrough
npm run verify:admissions-rls
npm run verify:enrollment-conversion-rls
npm run verify:llis-consent-rls
```

Provider-specific release gates must follow `docs/runbooks/provider-activation.md`.
