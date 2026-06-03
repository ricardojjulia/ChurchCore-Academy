# Phase 1 Sprint 2 Institution Configuration Types Defaults And Validation Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first Academy institution configuration domain module with types, default profiles, and validation tests.

**Architecture:** The new `src/modules/academy-config` module owns tenant-level institution configuration types, default profile creation, and deterministic validation. It does not add persistence, API routes, UI, auth, LMS adapter behavior, or ShepherdAI runtime changes.

**Tech Stack:** TypeScript, Node `node:test`, existing path aliases, existing `npm test`, `npm run lint`, and `npm run build` verification.

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

Data touched: in-memory TypeScript domain types only.

LMS impact: validates provider preference and LMS sync capability combinations, but does not implement any provider behavior.

Student PWA impact: defines `studentPwa` and related capability flags for future use, but does not implement routes.

ShepherdAI impact: defines `shepherdAiRecommendations` capability and validation boundaries, but does not add signals.

Security/privacy impact: validates guardian/minor combinations and creates a foundation for later tenant isolation and audit work.

## Files

- Create: `src/modules/academy-config/types.ts`
- Create: `src/modules/academy-config/defaults.ts`
- Create: `src/modules/academy-config/validation.ts`
- Create: `src/modules/academy-config/__tests__/institution-config.test.ts`
- Create: `docs/superpowers/plans/2026-06-01-phase-1-sprint-2-institution-config-types-defaults-validation.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Tests

- [x] Add tests for children's school defaults.
- [x] Add tests for postsecondary seminary defaults.
- [x] Add tests for valid and invalid mixed institutions.
- [x] Add tests for invalid guardian, LMS, and transcript combinations.
- [x] Run the test command and observe failure because the module does not exist.

RED command:

```bash
npm test -- src/modules/academy-config/__tests__/institution-config.test.ts
```

Observed failure:

```text
Error: Cannot find module '@/modules/academy-config/defaults'
```

### Task 2: Types

- [x] Add `InstitutionMode`.
- [x] Add operating-rule enum types.
- [x] Add LMS provider and selection status types.
- [x] Add `InstitutionOperatingRules`.
- [x] Add `InstitutionCapabilitySet`.
- [x] Add `InstitutionLmsPreference`.
- [x] Add `InstitutionProfile`.

### Task 3: Defaults

- [x] Add `createInstitutionProfileDefaults`.
- [x] Add children's school defaults with guardians and progress records.
- [x] Add seminary/college/university defaults with transcripts, credits, and GPA.
- [x] Add Bible school defaults with completion records.
- [x] Add mixed institution support through concrete mode defaults.
- [x] Add LMS capability defaults for Moodle and Canvas provider selections.

### Task 4: Validation

- [x] Validate non-empty supported modes.
- [x] Validate primary mode is included in supported modes.
- [x] Validate mixed mode requires at least two concrete modes.
- [x] Validate minors require guardian support.
- [x] Validate guardian portal requires guardian operating rules.
- [x] Validate LMS roster and grade return require Moodle or Canvas.
- [x] Validate transcript-bearing postsecondary modes use credits or clock hours.

### Task 5: Verification

- [x] Run focused test slice.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Scan docs and new module for placeholders, stale college-only language, and accidental LMS runtime behavior.

## Review Boundary

This sprint is complete when the institution configuration type/default/validation module is present and verified. It must not introduce database tables, API routes, UI, auth, LMS adapter behavior, or ShepherdAI signal changes.

## Next Sprint

Phase 1 Sprint 3 should add the institution configuration migration and seed data after this TypeScript domain surface is reviewed.
