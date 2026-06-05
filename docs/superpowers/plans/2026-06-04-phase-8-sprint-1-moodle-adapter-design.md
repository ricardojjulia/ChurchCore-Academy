# Phase 8 Sprint 1 Moodle Adapter Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Phase 8 Sprint 1 design package for the Moodle adapter without adding runtime Moodle behavior.

**Architecture:** This sprint defines Moodle as an adapter behind the provider-neutral LMS contract. Moodle Web Services are reserved for future server-to-server sync families, while student launch is treated as a separate configured launch mechanism such as OIDC or LTI where supported. Academy remains the SIS authority and Moodle remains an external delivery runtime.

**Tech Stack:** Markdown docs, existing Next.js/TypeScript verification commands.

---

## Factory Intake

- Product area: Moodle adapter.
- Institution modes: all supported institution modes.
- Data touched: documentation only.
- Student PWA impact: defines future safe Moodle launch response boundaries; no route, service worker, cache, or UI change is added.
- LMS impact: defines future Moodle adapter boundaries for launch, provisioning, roster/enrollment sync, grade/progress return, audit, reconciliation, and configuration.
- Security/privacy: documents Moodle token, OIDC, LTI, raw payload, provider-error, audit, and Student PWA exclusion rules.

## Files

- Create: `docs/superpowers/specs/2026-06-04-moodle-adapter-design.md`
- Create: `docs/adr/0015-moodle-adapter-integration-model.md`
- Create: `docs/adr/0016-moodle-credential-and-endpoint-storage-model.md`
- Create: `docs/superpowers/plans/2026-06-04-phase-8-sprint-1-moodle-adapter-design.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: Moodle Adapter Design Package

- [x] Create the Phase 8 Sprint 1 Moodle adapter design package.
- [x] Compare Moodle REST-only, LTI-first, OIDC-launch-plus-Web-Services, and Moodle-as-source-of-truth approaches.
- [x] Accept Moodle as a provider-neutral adapter with Web Services for server-to-server sync and separate launch configuration.
- [x] Define future Moodle mapping for identity launch, course shell provisioning, roster sync, enrollment sync, grade/progress return, audit, and reconciliation.
- [x] Define Moodle credential, endpoint, raw payload, provider-error, and Student PWA exclusion rules.
- [x] Define mocked Moodle contract conformance test requirements.
- [x] Document required Moodle configuration and source notes.

## Task 2: ADR

- [x] Create ADR 0015 for the Moodle adapter integration model.
- [x] Record context, decision, consequences, alternatives, security/privacy notes, testing notes, and rollback notes.
- [x] Create ADR 0016 for the Moodle credential and endpoint storage model.
- [x] Record tenant-scoped provider configuration, secret storage, browser exclusion, audit redaction, validation, and credential rotation boundaries.

## Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 8 Sprint 1 as complete in the roadmap.
- [x] Mark Moodle adapter ADR requirements complete in the roadmap.
- [x] Mark the Moodle adapter execution package complete in the master implementation plan.
- [x] Leave Moodle runtime implementation, mapping, retry/reconciliation behavior, contract conformance tests, provider docs, and trademark/deployment notes unchecked for future sprints.

## Task 4: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Scan new docs for runtime claims, Moodle-as-source-of-truth leakage, provider-secret leakage, and Student PWA cache violations.

## Review Boundary

This sprint is complete when the Moodle adapter design spec, ADR, roadmap update, and master-plan update are reviewable.

No runtime files should change in this sprint.

## Next Sprint

Phase 8 Sprint 2 should implement Moodle identity and launch mapping.

It should start with mocked contract tests, return display-safe `LmsLaunchResponse` objects, keep Moodle secrets out of Student PWA responses, and avoid course/roster/grade sync runtime until later Moodle sprints.
