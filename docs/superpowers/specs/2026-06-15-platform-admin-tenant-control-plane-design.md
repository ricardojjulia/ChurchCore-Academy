# Platform Admin Tenant Control Plane Design

Date: 2026-06-15
Status: approved for implementation
Product area: platform admin, multi-tenant identity, tenant provisioning, user provisioning

## Goal

Allow a platform administrator to sign into ChurchCore Academy, default into one DEMO tenant inside the app, switch across authorized tenants, create a new workable tenant, and create tenant-local users under the selected tenant without weakening Academy tenant isolation.

## Council Outcome

The HQ council approved the product direction and rejected immediate ad hoc coding.

Consensus:

- keep Academy runtime tenant-bound;
- add a separate platform control plane above tenant-scoped execution;
- do not permit cross-tenant runtime shortcuts for ordinary app flows;
- make the default post-login destination the app, not HQ;
- require a formal brief and ADR before implementation.

## Approved Product Decisions

The following decisions are approved for implementation:

- a fully workable new tenant in MVP includes everything required to operate, not only an institution profile;
- tenant creation must include institution profile, academic calendar shell, grading shell, department or subdivision shell, LMS defaults, and starter staff scaffolding;
- every new tenant requires an initial tenant-local institution admin before the tenant is considered usable;
- the platform admin creator account is also materialized by default as a tenant-local institution admin in the tenant it creates;
- multi-tenant switching is platform-admin only in MVP;
- DEMO is the default tenant on login until the admin switches to another tenant;
- platform admin is both a platform role and a materialized tenant-local user inside the tenants it administers.

## Current Constraint

The current Academy identity resolver is structurally single-tenant.

`resolveAcademyIdentity()` loads all active identities for the authenticated subject and rejects the session when more than one tenant is linked:

- `The account is linked to multiple active Academy tenants.`

That behavior is correct for the current system and must not be bypassed with UI-only tenant switching.

## MVP Scope

This slice adds:

- platform-admin sign-in that lands inside the app;
- default tenant selection to one DEMO tenant for platform admins;
- platform-admin tenant list and tenant switching;
- tenant creation with a fully workable Academy baseline;
- tenant-scoped user creation and tenant-role assignment under the selected tenant;
- durable platform audit events for tenant selection, tenant creation, and tenant-user provisioning.

This slice does not add:

- tenant deletion;
- tenant suspension or archival workflows beyond minimal lifecycle metadata;
- delegated non-admin multi-tenant switching;
- rich onboarding wizards for calendar, grading, LMS, or people templates;
- auto-activation of AI, learner intelligence, or predictive features for new tenants;
- cross-tenant runtime read or write access inside ordinary Academy modules.

## Users And Authority

### Platform admin

A platform admin is a user with a global platform role, not merely a tenant-local institution role.

Platform admins may:

- view all accessible tenants in the control plane;
- select an active tenant context;
- create a new tenant shell;
- provision tenant-local users and assign tenant roles;
- access HQ and platform administration surfaces.

Platform admins do not receive unrestricted cross-tenant runtime authority inside tenant modules. They must choose an active tenant and then operate through a normal tenant-scoped Academy actor.

### Tenant-local institution admin

A tenant-local institution admin remains the top operational authority inside a single tenant. Every newly created tenant must receive at least one tenant-local institution admin before the tenant is considered workable.

## Alternatives Considered

### Option A: Allow one Academy actor to span multiple tenants

Rejected. This would force widespread changes across request context, repository access, RLS expectations, and UI assumptions. It weakens the current clean tenant boundary.

### Option B: Store tenant choice only in browser state and patch routing

Rejected. Tenant selection is a security boundary and must be server-verifiable, durable, and auditable.

### Option C: Add a platform session context above the existing tenant actor

Selected. The authenticated subject first resolves to a platform session with platform roles, accessible tenants, and active tenant selection. The selected tenant is then converted into the existing tenant-scoped Academy actor shape for downstream execution.

## Target Architecture

The system splits identity into two layers.

### Layer 1: Platform session context

Resolved from the verified Supabase session.

It contains:

- authenticated subject id;
- platform roles such as `platform_admin` and `platform_staff`;
- accessible tenant registry rows;
- active tenant id;
- default tenant policy for platform users.

This layer powers:

- app entry routing;
- tenant selection;
- tenant creation;
- tenant-user provisioning;
- HQ access.

### Layer 2: Tenant-scoped Academy actor

Derived only after active tenant selection.

It preserves the current actor shape:

- `userId`;
- `tenantId`;
- `roles`.

All existing Academy modules, repositories, and request-scoped database context continue to run through this tenant-scoped actor.

## Default Routing Behavior

After login:

1. if the user is not authenticated, show `/login`;
2. if the user is authenticated and has exactly one tenant-local Academy identity, route into `/` for that tenant;
3. if the user is a platform admin, resolve the active tenant from saved preference;
4. if no saved preference exists, use the designated DEMO tenant;
5. if the active tenant is valid, route into `/` under that tenant context;
6. if no active tenant can be resolved, route to a tenant-selection surface inside the app;
7. HQ remains an explicit route and is never the default landing page.

## Demo Tenant Rules

One tenant is designated as the DEMO tenant for ongoing development.

Rules:

- DEMO is visible to platform admins;
- DEMO is the default selected tenant for a platform admin until another tenant is selected;
- DEMO must be visually labeled as demo/development;
- DEMO configuration and data must remain distinct from production-like tenants.

## Tenant Creation

Tenant creation is a platform-admin provisioning workflow.

### Required output for a workable MVP tenant

Creating a tenant must produce:

- one tenant registry record;
- one institution profile record;
- one baseline academic calendar shell;
- one baseline grading configuration shell;
- one baseline department or subdivision shell;
- one baseline LMS default configuration shell;
- one lifecycle state;
- one tenant-local initial institution admin user assignment;
- the platform admin creator account materialized as a tenant-local institution admin by default;
- starter staff scaffolding required for an immediately workable tenant;
- one provisioning audit trail.

### Not required in MVP

The following may remain outside automated tenant creation in MVP:

- full course catalog population;
- full faculty and student roster population;
- production LMS activation and secret entry;
- ShepherdAI and learner-intelligence activation;
- advanced onboarding wizards.

## Tenant-Local User Provisioning

Under an active tenant, platform admin may create users that belong to that tenant.

Provisioning creates or links:

- one tenant-local person record;
- one or more active role assignments;
- one Academy account link for the authenticated subject when applicable.

User creation must be strictly tenant-scoped. No user creation may occur without an explicit tenant target.

### MVP roles allowed at creation time

- `institution_admin`
- `dean`
- `registrar`
- `academic_admin`
- `admissions`
- `advisor`
- `faculty`
- `teacher`
- `professor`
- `student`
- `guardian`

No role defaults to institution admin.

## Domain Model Changes

### Platform role assignment

Add a global platform-role mapping table keyed to the authenticated subject.

Example fields:

- `external_subject`
- `platform_role`
- `status`
- `created_at`
- `created_by`

### Tenant registry or tenant metadata

Add a tenant control-plane registry that distinguishes runtime tenant identity from platform metadata.

Required fields:

- `tenant_id`
- `display_name`
- `tenant_kind` (`church`, `academy`, `seminary`, `college`, `university`, or other approved institution type)
- `lifecycle_status` (`demo`, `development`, `trial`, `active`, `suspended`, `archived`)
- `is_demo`
- `created_at`
- `created_by`
- `provisioning_status`

This may be a dedicated registry table or a companion table attached to `academy_institution_profiles`, but it must support platform-only metadata cleanly.

### Platform user preference

Add an active-tenant selection table keyed to the authenticated subject.

Required fields:

- `external_subject`
- `active_tenant_id`
- `updated_at`

### Provisioning audit

Add platform audit/event records for:

- tenant selected;
- tenant created;
- initial institution admin created;
- tenant-local user provisioned;
- provisioning completed or failed.

## Auth And Session Changes

### Replace the current resolver output model

Current behavior:

- `resolveAcademyIdentity()` returns one Academy actor or fails.

Required behavior:

- add a platform session resolver that may return multiple tenant memberships plus platform roles;
- add active tenant selection to session resolution;
- derive the existing tenant-scoped actor only after active tenant choice.

### Non-negotiable rules

- authorization must remain database-backed;
- Supabase user metadata is not authoritative for Academy tenant or role access;
- platform admin actions must be auditable;
- downstream Academy modules continue to receive one tenant-scoped actor only.

## API Surface

Add a platform control-plane API family.

### Session

```text
GET /api/platform/session
```

Returns:

- subject id;
- platform roles;
- accessible tenants;
- active tenant;
- whether HQ is available.

### Tenant selection

```text
POST /api/platform/tenants/select
```

Request:

- `tenantId`

Behavior:

- validates access;
- persists active tenant preference;
- returns resolved tenant summary.

### Tenant creation

```text
POST /api/platform/tenants
```

Request:

- institution display name;
- institution type or operating mode;
- demo/development flag;
- initial institution admin payload.

Behavior:

- creates the tenant shell transactionally when possible;
- returns provisioning status and tenant summary;
- emits audit events.

### Tenant user creation

```text
POST /api/platform/tenants/:tenantId/users
```

Request:

- person identity fields;
- desired tenant roles;
- link or invitation metadata.

Behavior:

- creates tenant-local person and role assignments;
- creates or links account identity according to approved auth flow;
- emits audit events.

## Security And RLS

Platform admin is a distinct trust boundary from tenant-local institution staff.

Rules:

- tenant-local reads and writes remain protected by tenant-scoped RLS;
- platform control-plane tables use separate policies keyed to platform roles;
- service-role access is reserved for explicit provisioning workflows only when unavoidable and must emit auditable events;
- platform admin must not gain silent cross-tenant data access through ordinary tenant APIs.

## Testing

Required automated coverage:

- platform session resolution for platform admin;
- active tenant default to DEMO when no preference exists;
- tenant selection allowed only for accessible tenants;
- tenant selection denied for inaccessible tenants;
- post-login routing defaults into the app, not HQ;
- single-tenant users continue to work without tenant picker regression;
- tenant creation writes the required baseline records;
- tenant creation requires initial institution admin payload;
- tenant-user creation is scoped to the selected tenant;
- cross-tenant user provisioning is denied;
- platform audit events are written for selection and provisioning actions;
- RLS matrices cover platform admin, tenant-local institution admin, tenant-local staff, student, and cross-tenant denial.

## Resolved Decisions

1. Platform admin also materializes as a tenant-local institution admin in each tenant it administers.
2. DEMO remains the default on login until the admin switches active tenant.
3. Multi-tenant switching is limited to platform admins in MVP.
4. Tenant creation includes starter staff scaffolding beyond only the initial institution admin.
5. The creating platform admin account is assigned by default inside the new tenant.
6. A workable MVP tenant must provision all major institutional shells, not only the institution profile.

## Delivery Gate

This slice is ready for implementation only when:

1. the ADR is approved;
2. the approved product decisions above are reflected in the implementation plan;
3. the platform session model and tenant actor derivation are specified in code-level terms;
4. schema, RLS, API, and routing acceptance criteria are approved;
5. implementation is explicitly scoped to MVP and excludes broader onboarding ambitions.