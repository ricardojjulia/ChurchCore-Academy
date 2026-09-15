# ADR-0030 — Legacy Dataset Deprecation Strategy

**Date:** 2026-06-18
**Status:** Accepted
**Deciders:** @ricardojjulia

---

## Context

`src/modules/academy-data/server-dataset.ts` and the helper `loadProtectedAcademyDataset()` were introduced in an early sprint as a combined mock-data + thin-DB read path for the ShepherdAI evaluator and several admin pages. They read from a set of legacy stub tables (`academy_students`, `academy_faculty`, `academy_programs`, `academy_sections`, `academy_thresholds`) that were created alongside the original ShepherdAI schema but predate the normalized SIS tables.

As of Council Review V, these legacy paths are still imported by runtime pages (`/admin/transcripts`, `/admin/workflows`) in violation of the architecture rule: _"Runtime pages may not import academy-data/mock-data."_

A full replacement in a single PR is too large and risky. A phased strategy with hard gates is required.

---

## Decision

### Rule (immediate, non-negotiable)

**No new `loadProtectedAcademyDataset` imports in runtime pages.** Any new page or API route must query the normalized tables directly via `withAcademyDatabaseContext` + the relevant module repository.

### Migration phases

**Phase A — Isolation (this sprint)**
- The two remaining runtime violations (`/admin/transcripts`, `/admin/workflows`) must migrate to direct repository queries before any MVP readiness claim.
- ShepherdAI evaluator dataset input must be rebuilt from normalized tables in the same sprint.

**Phase B — Removal (post Phase A)**
- Once no runtime page imports `loadProtectedAcademyDataset`, the function is marked `@deprecated` and blocked from new imports via ESLint rule.
- Legacy stub tables remain in the DB (non-destructive) until a separate data-migration sprint confirms they hold no production data.

**Phase C — Schema cleanup (separate sprint)**
- Drop legacy stub tables (`academy_admin_users`, `academy_programs`, `academy_students`, `academy_faculty`, `academy_sections`, `academy_thresholds`) after verifying no production data and no remaining references.

---

## Consequences

**Positive:**
- Pages will operate on real enrollment state, not seeded mock rows.
- Architecture rule is cleanly enforced.
- ShepherdAI signals become meaningful (based on real student data).

**Negative:**
- Phase A requires rebuilding the dataset shape that both the evaluator and several admin pages depend on — moderate effort.
- Until Phase A is complete, the SIS is partially operating on stub data, which limits demo fidelity.

---

## References

- Council Review V Agent 1 — SIS State Audit (top gap #1)
- Council Review V Agent 2 — Route & Page Audit (architecture violations)
- CLAUDE.md §Architecture rules: _"Runtime pages may not import academy-data/mock-data."_
