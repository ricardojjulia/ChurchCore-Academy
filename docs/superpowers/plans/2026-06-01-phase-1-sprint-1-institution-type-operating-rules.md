# Phase 1 Sprint 1 Institution Type And Operating Rules Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Phase 1 Sprint 1 design package for institution type and operating rules without changing runtime behavior.

**Architecture:** This sprint defines the Academy institution configuration model as documentation and ADRs only. Runtime implementation is deferred to later Phase 1 sprints after the design is reviewed.

**Tech Stack:** Markdown docs, existing Next.js/TypeScript verification commands.

---

## Factory Intake

Product area: Institution Configuration.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched: documentation only.

LMS impact: records provider preference and capability rules, but does not implement providers.

Student PWA impact: records future mode/capability flags for PWA behavior.

ShepherdAI impact: records future allowed institution-configuration signals.

Security/privacy impact: documents future tenant isolation, guardian, minor, transcript, LMS, and audit requirements.

## Files

- Create: `docs/superpowers/specs/2026-06-01-institution-type-operating-rules-design.md`
- Create: `docs/adr/0002-institution-type-and-operating-rules-model.md`
- Create: `docs/superpowers/plans/2026-06-01-phase-1-sprint-1-institution-type-operating-rules.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`
- Modify: `docs/software-factory.md`
- Modify: `README.md`

## Tasks

### Task 1: Design Package

- [x] Create the institution type and operating rules design package.
- [x] Compare single enum, feature matrix, and mode-plus-rules approaches.
- [x] Accept institution mode plus operating rules.
- [x] Define future domain model names.
- [x] Define validation rules.
- [x] Define security, privacy, LMS, and ShepherdAI boundaries.

### Task 2: ADR

- [x] Create ADR 0002.
- [x] Record accepted institution mode plus operating rules decision.
- [x] Record alternatives and consequences.
- [x] Record review notes for product boundary, LMS boundary, privacy, testing, and rollback.

### Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 1 Sprint 1 as complete in the factory roadmap.
- [x] Mark the sprint design package as complete in the master implementation plan.
- [x] Add the design package and ADR to software factory knowledge references.
- [x] Add the sprint design package to README planning docs.

### Task 4: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Scan docs for placeholders, stale college-only language, and accidental runtime claims.

## Review Boundary

This sprint is complete when the design package is reviewable and future implementation work can start from a stable domain decision.

No runtime files should change in this sprint.

## Next Sprint

Phase 1 Sprint 2 should implement institution configuration types, defaults, and validation tests in `src/modules/academy-config/`.
