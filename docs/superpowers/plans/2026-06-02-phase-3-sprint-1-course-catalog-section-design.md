# Phase 3 Sprint 1 Course Catalog And Section Design Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Phase 3 Sprint 1 design package for course catalogs and sections without changing runtime behavior.

**Architecture:** This sprint defines Course Catalog and Section models as documentation and ADRs only. Runtime implementation is deferred to later Phase 3 sprints so the product does not hardcode a college-only credit-course model or LMS-first course shell model.

**Tech Stack:** Markdown docs, existing Next.js/TypeScript verification commands.

---

## Factory Intake

Product area: Course Catalog, Sections, Instructional Assignment, and LMS Mapping References.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched: documentation only.

LMS impact: records future provider-neutral course shell mapping references for Moodle, Canvas, no-LMS, and external providers, but does not implement providers.

Student PWA impact: records future course, section, schedule, instructor, delivery mode, enrollment status, and LMS launch references.

ShepherdAI impact: records future allowed Academy-owned course setup signals and forbidden LMS/spiritual/counseling/giving signal sources.

Security/privacy impact: documents future tenant isolation, role-scoped access, audit history for course and section changes, student and guardian visibility rules, and LMS secret boundaries.

## Files

- Create: `docs/superpowers/specs/2026-06-02-course-catalog-section-design.md`
- Create: `docs/adr/0006-course-duration-and-credit-clock-hour-model.md`
- Create: `docs/adr/0007-provider-neutral-lms-course-shell-mapping.md`
- Create: `docs/superpowers/plans/2026-06-02-phase-3-sprint-1-course-catalog-section-design.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Course Catalog And Section Design Package

- [x] Create the Phase 3 Sprint 1 design package.
- [x] Compare college-only, generic activity, catalog-plus-section, LMS-first, and provider-neutral mapping approaches.
- [x] Accept catalog course plus scheduled section as the core model.
- [x] Accept typed duration with validation for credit, clock-hour, competency, narrative, and non-record courses.
- [x] Accept provider-neutral LMS shell mapping references.
- [x] Define future domain model names.
- [x] Define validation rules by institution mode.
- [x] Define security, privacy, LMS, PWA, and ShepherdAI boundaries.

### Task 2: ADRs

- [x] Create ADR 0006 for course duration and credit/clock-hour modeling.
- [x] Create ADR 0007 for provider-neutral LMS course shell mapping.
- [x] Record alternatives, consequences, and review notes.

### Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 3 Sprint 1 as complete in the factory roadmap.
- [x] Mark the course catalog design package as complete in the master implementation plan.
- [x] Leave runtime course types, persistence, API, workflows, UI, LMS adapter, student PWA, and ShepherdAI tasks unchecked for future sprints.

### Task 4: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm audit`.
- [x] Scan new docs for placeholders, stale college-only assumptions, and accidental runtime claims.

## Review Boundary

This sprint is complete when the course catalog and section design package is reviewable and future implementation work can start from stable domain decisions.

No runtime files should change in this sprint.

## Next Sprint

Phase 3 Sprint 2 should implement course catalog and section TypeScript types plus validation tests in a new module, likely `src/modules/course-catalog/`.

It should not add persistence, API routes, UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior.
