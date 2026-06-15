# Platform Admin Tenant Control Plane Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement platform-admin tenant selection, DEMO default routing, workable tenant creation, and tenant-scoped user provisioning while preserving the existing tenant-bound Academy runtime model.

**Architecture:** Add a platform control-plane session layer that resolves platform roles, accessible tenants, and active tenant preference. Derive the existing tenant-scoped Academy actor only after tenant selection. Introduce platform-scoped persistence and APIs for tenant management while keeping Academy modules tenant-bound.

**Tech Stack:** TypeScript, Next.js App Router, Postgres, Supabase SSR/browser auth, RLS, Node `node:test`.

---

## Factory Intake

Product area: platform admin, identity, tenant provisioning, user provisioning.

Security impact:

- high;
- touches identity resolution, tenant isolation, routing, provisioning, and audit.

User-facing outcome:

- platform admins sign in and land in the app under DEMO by default;
- platform admins can switch tenants;
- platform admins can create a new workable tenant;
- platform admins can create tenant-local users under the selected tenant.

## Files

- Modify: `src/modules/academy-auth/session-resolver.ts`
- Modify: `src/modules/academy-auth/postgres-identity-repository.ts`
- Modify: `src/modules/academy-auth/policy.ts`
- Modify: `src/modules/academy-auth/request-context.ts`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/modules/platform-admin/types.ts`
- Create: `src/modules/platform-admin/service.ts`
- Create: `src/modules/platform-admin/postgres-repository.ts`
- Create: `src/modules/platform-admin/__tests__/service.test.ts`
- Create: `src/modules/platform-admin/__tests__/routing-session.test.ts`
- Create: `src/app/api/platform/session/route.ts`
- Create: `src/app/api/platform/tenants/select/route.ts`
- Create: `src/app/api/platform/tenants/route.ts`
- Create: `src/app/api/platform/tenants/[tenantId]/users/route.ts`
- Create: `src/app/platform/tenants/page.tsx`
- Create: `src/app/platform/tenants/new/page.tsx`
- Create: `src/app/platform/tenants/[tenantId]/users/page.tsx`
- Create: `supabase/migrations/<timestamp>_platform_admin_tenant_control_plane.sql`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/software-factory.md`
- Modify: `docs/superpowers/specs/2026-06-15-platform-admin-tenant-control-plane-design.md`

## Tasks

### Task 1: Platform Session Model

- [ ] Add a platform session context type.
- [ ] Separate platform roles from tenant-local Academy roles.
- [ ] Resolve accessible tenants for platform admins.
- [ ] Resolve active tenant preference.
- [ ] Preserve existing tenant-scoped actor derivation after tenant selection.
- [ ] Add tests for single-tenant users, platform admins, and multi-tenant denial regression.

### Task 2: Control-Plane Schema

- [ ] Add platform role assignment persistence.
- [ ] Add tenant registry or tenant metadata persistence.
- [ ] Add active tenant preference persistence.
- [ ] Add platform audit or provisioning event persistence.
- [ ] Add DEMO designation and lifecycle status support.
- [ ] Add RLS or explicit access strategy for platform control-plane tables.

### Task 3: Default Routing And Tenant Selection

- [ ] Update app entry routing to prefer app root, not HQ.
- [ ] For platform admins, default to DEMO tenant until a different active tenant is selected.
- [ ] Add platform session endpoint.
- [ ] Add tenant selection endpoint.
- [ ] Add route tests for default and switched tenant selection behavior.

### Task 4: Tenant Creation Workflow

- [ ] Add tenant creation service and repository.
- [ ] Provision tenant registry metadata.
- [ ] Provision institution profile.
- [ ] Provision academic calendar shell.
- [ ] Provision grading shell.
- [ ] Provision department or subdivision shell.
- [ ] Provision LMS defaults shell.
- [ ] Provision starter staff scaffolding.
- [ ] Materialize the creating platform admin as a tenant-local institution admin.
- [ ] Require one initial tenant-local institution admin.
- [ ] Emit provisioning audit records.
- [ ] Add idempotency and rollback behavior.

### Task 5: Tenant-Local User Provisioning

- [ ] Add API for tenant-scoped user creation under selected tenant.
- [ ] Create tenant-local people records.
- [ ] Create role assignments.
- [ ] Link existing authenticated users when approved by flow.
- [ ] Add tests for cross-tenant denial and tenant-local success paths.

### Task 6: UI Surfaces

- [ ] Add platform tenant list and active-tenant switcher UI.
- [ ] Add new-tenant creation surface.
- [ ] Add tenant-local user creation surface.
- [ ] Clearly label DEMO tenant.
- [ ] Keep HQ explicit and separate from the default app landing path.

### Task 7: Verification

- [ ] Add resolver tests for platform session and tenant actor derivation.
- [ ] Add API tests for session, tenant selection, tenant creation, and tenant-user creation.
- [ ] Add migration tests for control-plane schema.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Perform authenticated browser walkthrough for DEMO default, tenant switch, tenant create, and tenant-user create.

## Review Boundary

This plan is complete when platform admin can enter the app through DEMO by default, switch tenants, create a workable new tenant, and create tenant-scoped users, while all ordinary Academy runtime behavior remains tenant-bound.

## Next Phase

After MVP, add richer tenant templates, delegated onboarding, tenant lifecycle administration, non-admin multi-tenant switching, and automated demo reset tooling.