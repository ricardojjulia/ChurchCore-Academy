---
name: council
description: Runs the ChurchCore Academy Council review: four read-only audit voices, synthesis, Documenter close-out, verification, and pr-review gating for non-trivial work.
---

# ChurchCore Academy Council

`docs/development-guide.md` is the source of truth. `IMPROVE-SOFTWARE.md` is the detailed prompt appendix. This skill makes that process operational.

## Chain

1. Read `docs/development-guide.md`, `CLAUDE.md`, `AGENTS.md`, and any supporting docs needed for the scoped review.
2. Scope the Council to either the full repo, a product area, or the current diff. Say which one it is.
3. Run four read-only audits in parallel:
   - Agent 1: SIS/data/API/security state
   - Agent 2: routes/pages/API completeness
   - Agent 3: UX/shell/accessibility/error states
   - Agent 4: feature/competitive/product-readiness
   - Testing Council: test surface, journeys, personas, known issues, denied-role/cross-tenant evidence, CI proof
4. Synthesize findings into `docs/reviews/YYYY-MM-DD-council-review-[N]-synthesis.md`, with individual agent reports when a full Council is run.
5. Draft ADRs for durable decisions before implementation begins.
6. Convert approved findings into feature-factory prompts or scoped implementation plans.
7. After implementation, require verification evidence: targeted checks, `npm run verify`, and `npm run test:full` when the surface requires it.
8. Run the Documenter close-out: update roadmap/status docs, `CHANGELOG.md`, README/docs, ADRs, and the factory run record.
9. Run `pr-review` against the final diff before merge.

## Rules

- Agents 1-4 are read-only.
- The Documenter writes docs only; it does not patch production code to make a result look complete.
- A red verification result routes back to implementation, not forward to PR.
- Do not substitute a Council pass for the mandatory `pr-review` gate.
- For small fixes that skip Council, record why the change is trivial in the PR.
