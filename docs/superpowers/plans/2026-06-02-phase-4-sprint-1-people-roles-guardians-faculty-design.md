# Phase 4 Sprint 1 People Roles Guardians Faculty Design Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Phase 4 Sprint 1 design package for people, roles, guardians, and faculty without changing runtime behavior.

**Architecture:** This sprint defines the people domain as documentation and ADRs only. Runtime implementation is deferred to later Phase 4 sprints so the product does not hardcode account-only users, tenant-wide guardian access, or college-only faculty assumptions.

**Tech Stack:** Markdown docs, existing Next.js/TypeScript verification commands.

---

## Factory Intake

Product area: People Directory, Role Boundaries, Guardian Relationships, Faculty/Teacher Assignment, and Student Visibility.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched: documentation only.

LMS impact: records future provider-neutral person identity references for Moodle, Canvas, no-LMS, and external providers, but does not implement providers.

Student PWA impact: records future student self-access and guardian relationship-scoped access boundaries.

ShepherdAI impact: records future allowed Academy-owned people/setup signals and forbidden LMS/spiritual/counseling/giving signal sources.

Security/privacy impact: documents future tenant isolation, relationship-scoped guardian access, role-scoped access, audit history for permission changes, and LMS secret boundaries.

## Files

- Create: `docs/superpowers/specs/2026-06-02-people-roles-guardians-faculty-design.md`
- Create: `docs/adr/0008-people-role-assignment-and-permission-model.md`
- Create: `docs/adr/0009-guardian-relationship-scoped-access-model.md`
- Create: `docs/superpowers/plans/2026-06-02-phase-4-sprint-1-people-roles-guardians-faculty-design.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: People And Roles Design Package

- [x] Create the Phase 4 Sprint 1 design package.
- [x] Compare account-centric users, separate student/staff tables, person-plus-role-assignment, and generic relationship graph approaches.
- [x] Accept person core plus scoped role assignments as the core model.
- [x] Accept relationship-scoped guardian access.
- [x] Define future domain model names.
- [x] Define validation rules by role, relationship, tenant, and institution mode.
- [x] Define security, privacy, LMS, PWA, and ShepherdAI boundaries.

### Task 2: ADRs

- [x] Create ADR 0008 for people role assignment and permission modeling.
- [x] Create ADR 0009 for guardian relationship-scoped access.
- [x] Record alternatives, consequences, and review notes.

### Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 4 Sprint 1 as complete in the factory roadmap.
- [x] Mark the people and roles design package as complete in the master implementation plan.
- [x] Leave runtime people types, persistence, API access patterns, guardian relationship implementation, admin UI, LMS adapter, student PWA, and ShepherdAI runtime tasks unchecked for future sprints.

### Task 4: Verification

- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Scan new docs for placeholders, stale college-only assumptions, and accidental runtime claims.

## Review Boundary

This sprint is complete when the people, roles, guardians, and faculty design package is reviewable and future implementation work can start from stable domain decisions.

No runtime files should change in this sprint.

## Next Sprint

Phase 4 Sprint 2 should implement people, role assignment, student profile, staff profile, relationship, and account-link TypeScript types plus validation tests in a new module, likely `src/modules/people/`.

It should not add persistence, API routes, UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior.
