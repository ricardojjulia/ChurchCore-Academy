# Factory Operating Model Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the one-week sprint operating model, ADR procedure, reviewer procedure, and Product Opportunity Scout agent for ChurchCore Academy.

**Architecture:** This plan adds process documentation only. It keeps product execution under the existing software factory and does not change application runtime behavior.

**Tech Stack:** Markdown docs, existing Next.js/TypeScript verification commands.

---

## Tasks

### Task 1: Factory Roadmap

**Files:**

- Create: `docs/product/factory-roadmap.md`

- [x] Define the current project position.
- [x] Define the one-week sprint cadence.
- [x] Define weekly sprint shape.
- [x] Define reviewable and invalid boundaries.
- [x] Break the master plan into phases and suggested one-week sprints.
- [x] Define sprint exit decisions.

### Task 2: ADR Procedure

**Files:**

- Create: `docs/adr/README.md`
- Create: `docs/adr/0001-use-one-week-factory-sprints.md`

- [x] Define when ADRs are required.
- [x] Define ADR naming.
- [x] Define ADR template.
- [x] Record the accepted one-week sprint cadence decision.

### Task 3: Reviewer Procedure

**Files:**

- Create: `docs/reviews/reviewer-procedure.md`

- [x] Define review inputs.
- [x] Define review order.
- [x] Define required verification commands.
- [x] Define review decisions.
- [x] Define pull request checklist.

### Task 4: Product Opportunity Scout

**Files:**

- Create: `docs/agents/product-opportunity-scout.md`

- [x] Define the scout purpose.
- [x] Define operating rules.
- [x] Define randomization method.
- [x] Define opportunity brief template.
- [x] Add example ideas with adopt, park, and reject outcomes.

### Task 5: Verification

**Files:**

- No runtime files changed.

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Scan docs for placeholders or stale college-only language.
