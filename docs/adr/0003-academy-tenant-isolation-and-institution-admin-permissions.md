# ADR 0003: Academy Tenant Isolation And Institution Admin Permissions

Date: 2026-06-01
Status: accepted

## Context

Institution configuration is the first Academy system-of-record model. Academic calendars, subdivisions, course catalogs, grading, transcripts, student PWA data, LMS provider selection, and ShepherdAI recommendations will all depend on this tenant boundary.

The repository already reads institution profiles by `tenant_id`, but the product needs a reusable authorization rule before editable configuration or future admin pages are added.

## Decision

ChurchCore Academy will treat tenant identity as mandatory for Academy configuration access.

An Academy request actor contains:

- `userId`
- `tenantId`
- one or more Academy roles

Institution configuration permissions are:

- read: `institution_admin`, `dean`, `registrar`, or `academic_admin`
- write: `institution_admin`
- admin: `institution_admin`

Every institution configuration access must satisfy both conditions:

- the actor tenant matches the requested tenant
- the actor has a role allowed for the requested action

There is no cross-tenant platform bypass in this phase. A future platform support role requires a separate ADR, audit model, and customer-support access procedure.

## Consequences

Future configuration routes can use one shared policy instead of duplicating role checks. Calendar, subdivision, grading, LMS, and student PWA work can depend on a clear tenant rule.

The tradeoff is that local development still needs a temporary request-context resolver until Supabase Auth and real session claims are wired. That resolver must be labeled as development/bootstrap behavior and must not be treated as production authentication.

## Alternatives Considered

Repository-only tenant filtering:

- rejected because it prevents accidental cross-tenant SQL reads but does not decide who may request a tenant

Route-specific role checks:

- rejected because every future admin route would drift independently

Central policy module:

- accepted because it is deterministic, testable, and reusable by API routes and future server actions

## Review Notes

- Product boundary: Academy owns the institution configuration permission model for Academy data only.
- LMS boundary: LMS credentials, OAuth, sync jobs, and provider runtime permissions remain out of this phase.
- Security/privacy: no edit endpoint ships in this sprint; write/admin permissions are defined now for future use.
- Testing: policy tests must cover allowed roles, denied roles, cross-tenant access, and config API payload enforcement.
- Rollback: policy changes are code-only and do not require database migration rollback.
