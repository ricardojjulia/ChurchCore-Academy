---
name: pr-review
description: Mandatory pre-merge review gate for every ChurchCore Academy PR, separate from the Council mandate.
---

# ChurchCore Academy PR Review

Run this before merge for every PR or reviewable diff.

## Chain

1. Read `CLAUDE.md`, `AGENTS.md`, the PR description, relevant ADRs, and the current diff.
2. Invoke or emulate the `pr-reviewer` role from `.claude/agents/pr-reviewer.md`.
3. Classify findings as Critical, Important, or Minor.
4. Critical or Important findings block merge until fixed, explained as false positives, or explicitly deferred with a tracking issue and owner.
5. Re-run the gate after fixes that touch correctness, security, data isolation, UI behavior, or tests.
6. Record the final review result in the PR description or factory run record.

## Checklist

- Scope is focused and does not bundle unrelated refactors.
- Academy/LMS boundary is preserved.
- Tenant, role, student, guardian, transcript, grade, billing, LMS, ShepherdAI, LLIS, and telemetry risks are addressed where relevant.
- New routes/API methods are represented in the e2e surface manifest.
- New workflows have a journey spec or a documented reason they do not.
- `npm run verify:governance`, `npm run verify`, and any relevant focused checks are recorded with pass/fail status.
- `npm run test:full` is recorded for user-facing, auth, routing, or release changes.
