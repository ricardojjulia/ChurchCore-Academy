# Phase 6 Sprint 1 Student PWA Design Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Phase 6 Sprint 1 design package for the Student PWA without changing runtime behavior.

**Architecture:** This sprint defines the Student PWA as a single Academy-owned route family backed by future student-scoped read models. Runtime route, manifest, API, read-model, LMS provider, offline cache, and ShepherdAI behavior are deferred to later Phase 6 and Phase 7 sprints.

**Tech Stack:** Markdown docs, existing Next.js/TypeScript verification commands.

---

## Factory Intake

Product area: Student PWA, Student Self-Service, Guardian-Visible Records, Mobile Installability, Offline-Friendly Student Workflows, and LMS Launch Boundary.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched: documentation only.

LMS impact: records future provider-neutral launch posture for no-LMS, Moodle, Canvas, and future providers, but does not implement provider behavior.

Student PWA impact: defines route structure, read-model boundaries, installability strategy, offline posture, student self-access, guardian visibility, and future browser verification.

ShepherdAI impact: records future Academy-owned student action reminder boundaries and forbidden signal sources.

Security/privacy impact: documents future tenant isolation, student self-scope, active guardian relationship checks, release-state filtering, transcript hold filtering, offline cache minimization, staff-preview audit requirements, and provider-secret exclusion.

## Files

- Create: `docs/superpowers/specs/2026-06-03-student-pwa-design.md`
- Create: `docs/adr/0012-student-pwa-routing-and-offline-strategy.md`
- Create: `docs/adr/0013-student-pwa-data-exposure-model.md`
- Create: `docs/superpowers/plans/2026-06-03-phase-6-sprint-1-student-pwa-design.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Student PWA Design Package

- [x] Create the Phase 6 Sprint 1 design package.
- [x] Compare college-style student portal, LMS-first PWA, Academy read-model PWA, and separate-mode PWA approaches.
- [x] Accept one Academy-owned `/student` route family backed by future student-scoped read models.
- [x] Define future route structure for dashboard, courses, schedule, progress, documents, messages, and LMS launch.
- [x] Define student self-access, active guardian relationship access, and audited staff-preview boundaries.
- [x] Define conservative offline and installability posture.
- [x] Define LMS launch boundary before and after the Phase 7 provider contract.
- [x] Define ShepherdAI student reminder boundary and forbidden signal sources.

### Task 2: ADRs

- [x] Create ADR 0012 for Student PWA routing and offline strategy.
- [x] Create ADR 0013 for Student PWA data exposure model.
- [x] Record alternatives, consequences, security/privacy notes, testing notes, and rollback notes.

### Task 3: Roadmap And Master Plan Updates

- [x] Clean up the stale roadmap Current Position section.
- [x] Mark Phase 1 through Phase 5 complete in the roadmap summary.
- [x] Mark Phase 6 as the current phase.
- [x] Mark Phase 6 Sprint 1 as complete in the roadmap.
- [x] Mark the Student PWA detailed execution package complete in the master implementation plan.
- [x] Leave runtime route group, manifest, dashboard, read models, offline shell, tests, browser verification, and installability verification unchecked for future sprints.

### Task 4: Verification

- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Scan new docs for placeholders, stale college-only assumptions, LMS-as-source-of-truth assumptions, and accidental runtime claims.

## Review Boundary

This sprint is complete when the Student PWA design package, ADRs, roadmap cleanup, and master-plan updates are reviewable.

No runtime files should change in this sprint.

## Next Sprint

Phase 6 Sprint 2 should implement the Student PWA shell and manifest.

It should add `src/app/student/` routes, app manifest metadata, student navigation shell, safe placeholder panels, no-LMS/pending-LMS states, and browser verification for desktop and mobile. It should not add full student read models, official grade display, document storage, messaging, Moodle calls, Canvas calls, provider credentials, ShepherdAI runtime behavior, or offline caching of sensitive academic records.
