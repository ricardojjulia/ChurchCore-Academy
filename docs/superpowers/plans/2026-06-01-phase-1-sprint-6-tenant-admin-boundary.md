# Phase 1 Sprint 6: Tenant Admin Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down the tenant and institution-admin permission boundary that future Academy configuration pages and APIs will depend on.

**Architecture:** Add a small `academy-auth` policy module for deterministic tenant/role decisions. Apply it to the institution configuration read payload so API callers must have same-tenant read access before repository data is returned. Keep this sprint read-only and avoid Supabase Auth/session wiring until the future people-and-roles phase.

**Tech Stack:** Next.js App Router, TypeScript, node:test, Supabase/Postgres repository boundary.

---

## Factory Intake

- Product area: Academy institution configuration security boundary.
- Sprint length: 1 week.
- Reviewable outcome: accepted ADR, tested policy module, and institution config API enforcement.
- Institution modes affected: all modes, because tenant configuration gates future Bible school, children's school, seminary, college, university, and mixed institution behavior.
- Boundary: authorization policy and read-path enforcement only. No editable configuration endpoint, no Supabase Auth integration, no LMS runtime code.

## Files

- Create: `docs/adr/0003-academy-tenant-isolation-and-institution-admin-permissions.md`
- Create: `src/modules/academy-auth/policy.ts`
- Create: `src/modules/academy-auth/request-context.ts`
- Create: `src/modules/academy-auth/__tests__/policy.test.ts`
- Modify: `src/app/api/academy/api-utils.ts`
- Modify: `src/app/api/academy/config/institution/route.ts`
- Modify: `src/modules/academy-config/__tests__/institution-config-repository.test.ts`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: Policy Tests

- [x] Write failing tests for same-tenant read/admin permissions and cross-tenant denial.
- [x] Run `npm test -- src/modules/academy-auth/__tests__/policy.test.ts` and confirm failure because `academy-auth/policy` does not exist.
- [x] Implement `AcademyActor`, `AcademyRole`, `InstitutionConfigAction`, `canAccessInstitutionConfig`, and `assertInstitutionConfigAccess`.
- [x] Run focused policy tests and confirm they pass.

## Task 2: Institution Config Read Enforcement

- [x] Update config payload builder to require an actor and authorize read access before repository lookup.
- [x] Add tests for authorized same-tenant payload access and denied cross-tenant payload access.
- [x] Update API error helper so forbidden authorization errors return HTTP 403.
- [x] Add a bootstrap request context resolver for the current local route, clearly isolated from real auth.

## Task 3: Factory Closeout

- [x] Mark Sprint 6 complete in the roadmap.
- [x] Mark tenant isolation and institution-level admin security review complete in the master implementation plan.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Start `npm run dev` and verify the institution config API and admin review page.

## Security Notes

- The policy denies access unless tenant and role both match.
- The API route remains read-only.
- Local bootstrap headers are not production authentication; Supabase Auth/session claims must replace them before customer deployment.
- A future platform-support cross-tenant access role requires a separate ADR and audit trail.
