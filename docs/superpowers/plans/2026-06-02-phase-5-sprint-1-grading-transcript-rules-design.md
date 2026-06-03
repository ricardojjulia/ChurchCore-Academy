# Phase 5 Sprint 1 Grading And Transcript Rules Design Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Phase 5 Sprint 1 design package for grading, transcript, progress, promotion, graduation, and academic record audit rules without changing runtime behavior.

**Architecture:** This sprint defines grading and official-record concepts as documentation and ADRs only. Runtime implementation is deferred to later Phase 5 sprints so the product does not hardcode a college-only GPA/transcript model or an LMS-first gradebook model.

**Tech Stack:** Markdown docs, existing Next.js/TypeScript verification commands.

---

## Factory Intake

Product area: Grading, Evaluation, Official Records, Promotion, Graduation, and Academic Standing.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched: documentation only.

LMS impact: records future provider-neutral grade return boundaries for Moodle, Canvas, no-LMS, and external providers, but does not implement providers.

Student PWA impact: records future student and guardian visibility boundaries for released grades, progress, transcripts, standing, and completion readiness.

ShepherdAI impact: records future allowed Academy-owned academic record signals and forbidden LMS/spiritual/counseling/giving signal sources.

Security/privacy impact: documents future tenant isolation, role-scoped grade entry, registrar-controlled official posting, relationship-scoped guardian visibility, transcript holds, grade-change audit history, and LMS secret boundaries.

## Files

- Create: `docs/superpowers/specs/2026-06-02-grading-transcript-rules-design.md`
- Create: `docs/adr/0010-evaluation-type-and-grading-rule-model.md`
- Create: `docs/adr/0011-official-record-transcript-and-audit-model.md`
- Create: `docs/superpowers/plans/2026-06-02-phase-5-sprint-1-grading-transcript-rules-design.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Grading And Transcript Design Package

- [x] Create the Phase 5 Sprint 1 design package.
- [x] Compare college-only transcript, generic evaluation blob, evaluation-plus-official-record, LMS-first, and provider-neutral grade-return approaches.
- [x] Accept typed evaluation rule sets for grading and progress evaluation.
- [x] Accept separate official record posting for transcripts, progress records, completion records, promotion, and graduation audit.
- [x] Define future domain model names.
- [x] Define validation rules by institution mode, evaluation type, official record type, posting policy, and LMS boundary.
- [x] Define security, privacy, PWA, LMS, and ShepherdAI boundaries.

### Task 2: ADRs

- [x] Create ADR 0010 for evaluation type and grading rule modeling.
- [x] Create ADR 0011 for official record, transcript, and audit modeling.
- [x] Record alternatives, consequences, and review notes.

### Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 5 Sprint 1 as complete in the factory roadmap.
- [x] Mark the grading and transcript design package as complete in the master implementation plan.
- [x] Mark security and audit review for grade, transcript, promotion, and graduation changes complete at design level.
- [x] Leave runtime grading types, persistence, evaluators, API routes, UI, LMS adapter behavior, student PWA, and ShepherdAI runtime tasks unchecked for future sprints.

### Task 4: Verification

- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Scan new docs for placeholders, stale college-only assumptions, LMS-as-source-of-truth assumptions, and accidental runtime claims.

## Review Boundary

This sprint is complete when the grading and transcript design package is reviewable and future implementation work can start from stable domain decisions.

No runtime files should change in this sprint.

## Next Sprint

Phase 5 Sprint 2 should implement grading profile, evaluation scale, scale band, evaluation rule set, official record rule, standing rule, and audit TypeScript types plus validation tests in a new module, likely `src/modules/grading-records/`.

It should not add persistence, API routes, UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior.
