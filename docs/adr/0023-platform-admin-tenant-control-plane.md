# ADR 0023: Platform Admin Tenant Control Plane

Date: 2026-06-15
Status: accepted

## Context

ChurchCore Academy currently derives one tenant-scoped Academy actor from the authenticated Supabase session. The resolver rejects accounts linked to multiple active Academy tenants.

That model preserves tenant isolation, but it prevents legitimate platform-administration capabilities such as:

- accessing multiple tenants as a platform admin;
- defaulting platform admins into a DEMO tenant inside the app;
- creating new tenants;
- provisioning tenant-local users under a selected tenant.

The product now requires a platform-admin control plane without weakening the tenant-scoped runtime model used by Academy modules.

Approved product constraints:

- platform admins default into the DEMO tenant until they switch;
- multi-tenant switching is platform-admin only in MVP;
- new tenants must be provisioned as workable institutional shells, not mere placeholder profiles;
- every created tenant must include an initial tenant-local institution admin;
- the creating platform admin must also materialize as a tenant-local institution admin inside the created tenant.

## Decision

ChurchCore Academy will keep its runtime execution tenant-bound and introduce a separate platform control plane above it.

The authenticated session resolves first into a platform session context that may contain:

- platform roles;
- accessible tenants;
- active tenant selection.

Only after active tenant selection will the system derive the existing tenant-scoped Academy actor shape for downstream application code.

Platform admin capabilities such as tenant selection, tenant creation, and tenant-user provisioning will operate through dedicated platform APIs, platform-scoped persistence, and explicit audit events.

Tenant creation in MVP must provision a workable institutional shell including institution profile, calendar shell, grading shell, department or subdivision shell, LMS defaults shell, starter staff scaffolding, and tenant-local institution administration.

HQ remains a separate explicit workspace and is not the default post-login destination.

## Consequences

Tenant isolation remains the primary runtime boundary.

Existing tenant-scoped Academy modules can largely remain unchanged because they still receive one tenant-scoped actor.

Authentication and routing become more complex because the system must distinguish:

- authenticated subject;
- platform roles;
- accessible tenants;
- active tenant;
- tenant-scoped actor.

Platform-admin provisioning and tenant switching become auditable first-class workflows instead of implicit session behavior.

## Alternatives Considered

Multi-tenant runtime actor:

- rejected because it would spread cross-tenant complexity across the entire codebase and weaken the current safety model.

UI-only tenant selection with no server-side active tenant context:

- rejected because tenant choice is a security boundary and must be durable, validated, and auditable.

Platform control plane above tenant-scoped runtime:

- accepted because it satisfies platform-admin requirements while preserving existing tenant-scoped application assumptions.

## Review Notes

- Product boundary: platform admin is a control-plane capability; tenant-local Academy behavior remains tenant-scoped.
- Security/privacy: no cross-tenant runtime shortcuts; platform actions must be audited; Supabase metadata is not authoritative for tenant access.
- Testing: multi-tenant session resolution, tenant selection, tenant creation, tenant-user provisioning, and routing regression coverage are required.
- Rollback: reverting requires disabling platform control-plane features because the current single-tenant resolver cannot safely support them.