# Phase 2 Sprint 1 Academic Calendar And Subdivision Design Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Phase 2 Sprint 1 design package for academic calendars and institutional subdivisions without changing runtime behavior.

**Architecture:** This sprint defines the Academic Calendar and Institutional Structure models as documentation and ADRs only. Runtime implementation is deferred to later Phase 2 sprints after the design is reviewed, so the product does not hardcode a college-style semester model.

**Tech Stack:** Markdown docs, existing Next.js/TypeScript verification commands.

---

## Factory Intake

Product area: Academic Calendar and Institutional Structure.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched: documentation only.

LMS impact: records future period and subdivision references for provider-neutral LMS mapping, but does not implement providers.

Student PWA impact: records future schedule, term, module, cohort, grade-band, campus, and school context.

ShepherdAI impact: records future allowed Academy-owned calendar and subdivision setup signals.

Security/privacy impact: documents future tenant isolation, role-scoped access, audit history for date changes, guardian visibility review, and LMS boundary requirements.

## Files

- Create: `docs/superpowers/specs/2026-06-01-academic-calendar-subdivision-design.md`
- Create: `docs/adr/0004-academic-period-model.md`
- Create: `docs/adr/0005-institution-subdivision-hierarchy.md`
- Create: `docs/superpowers/plans/2026-06-01-phase-2-sprint-1-academic-calendar-subdivision-design.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Calendar And Subdivision Design Package

- [x] Create the Phase 2 Sprint 1 design package.
- [x] Compare college-semester, arbitrary date range, and typed-period calendar approaches.
- [x] Accept calendar system plus typed academic period hierarchy.
- [x] Compare generic organization tree and typed subdivision approaches.
- [x] Accept typed subdivisions with optional parent links.
- [x] Define future domain model names.
- [x] Define validation rules by institution mode.
- [x] Define security, privacy, LMS, PWA, and ShepherdAI boundaries.

### Task 2: ADRs

- [x] Create ADR 0004 for the academic period model.
- [x] Create ADR 0005 for the institution subdivision hierarchy.
- [x] Record alternatives, consequences, and review notes.

### Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 2 Sprint 1 as complete in the factory roadmap.
- [x] Mark the academic calendar execution package as complete in the master implementation plan.
- [x] Leave runtime calendar, subdivision, persistence, and UI tasks unchecked for future sprints.

### Task 4: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Scan new docs for placeholders, stale college-only assumptions, and accidental runtime claims.

## Review Boundary

This sprint is complete when the calendar and subdivision design package is reviewable and future implementation work can start from stable domain decisions.

No runtime files should change in this sprint.

## Next Sprint

Phase 2 Sprint 2 should implement academic calendar and subdivision TypeScript types plus validation tests in a new module, likely `src/modules/academic-calendar/`. It should not add persistence, API routes, UI, LMS adapter behavior, or ShepherdAI runtime behavior.
