# Phase 7 Sprint 1 LMS Contract Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Phase 7 Sprint 1 design package for the provider-neutral LMS contract and no-LMS mode without changing runtime behavior.

**Architecture:** This sprint defines the LMS contract as an adapter boundary around Moodle, Canvas, and no-LMS providers. Academy remains the SIS authority; provider adapters return normalized launch, sync, import, audit, and reconciliation outcomes without storing provider secrets or raw payloads in Academy domain records.

**Tech Stack:** Markdown docs, existing Next.js/TypeScript verification commands.

---

## Factory Intake

- Product area: LMS provider contract and no-LMS mode.
- Institution modes: all supported institution modes.
- Data touched: documentation only.
- Student PWA impact: defines future provider-neutral launch response boundaries; no runtime launch behavior is added.
- LMS impact: defines future contract families for launch, logout, provisioning, mapping, roster sync, enrollment sync, grade return, progress return, webhooks, audit, and reconciliation.
- Security/privacy: provider secrets, tokens, webhook signatures, raw provider payloads, launch secrets, and provider runtime errors stay outside Academy domain and Student PWA read models.

## Files

- Create: `docs/superpowers/specs/2026-06-04-lms-contract-design.md`
- Create: `docs/adr/0014-lms-provider-contract-and-no-lms-mode.md`
- Create: `docs/superpowers/plans/2026-06-04-phase-7-sprint-1-lms-contract-design.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: LMS Contract Design Package

- [x] Create the Phase 7 Sprint 1 design package.
- [x] Compare Moodle-first, Canvas-first, adapter-specific, and provider-neutral contract approaches.
- [x] Accept a provider-neutral contract with provider capability discovery.
- [x] Define no-LMS as a first-class provider implementation.
- [x] Define future contract families for identity launch, logout, course shell provisioning, mapping, roster sync, enrollment sync, grade return, progress return, webhooks, audit, and reconciliation.
- [x] Define Student PWA launch response boundaries and provider-secret exclusions.
- [x] Define grade/progress return as reviewed imports before official display.

## Task 2: ADR

- [x] Create ADR 0014 for the LMS provider contract and no-LMS mode.
- [x] Record context, decision, consequences, alternatives, security/privacy notes, testing notes, and rollback notes.

## Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 7 Sprint 1 as complete in the roadmap.
- [x] Mark the LMS provider contract execution package complete in the master implementation plan.
- [x] Leave provider-neutral runtime interfaces, contract tests, no-LMS implementation, tenant provider selection, audit logs, failure-mode tests, Moodle adapter, and Canvas adapter unchecked for future sprints.

## Task 4: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Scan new docs for provider-specific coupling, provider-secret leakage, no-LMS gaps, Student PWA cache violations, and runtime claims.

## Review Boundary

This sprint is complete when the LMS contract design spec, ADR, roadmap update, and master-plan update are reviewable.

No runtime files should change in this sprint.

## Next Sprint

Phase 7 Sprint 2 should implement provider-neutral LMS contract types and contract tests under a dedicated LMS contract module.

It should add pure TypeScript interfaces, no provider network calls, no credential storage, no migrations, and no UI. The tests should cover capability discovery, no-LMS unsupported outcomes, safe launch response shape, provider-secret exclusion, idempotency fields, webhook deduplication fields, grade/progress reviewed-import status, and reconciliation report shape.
