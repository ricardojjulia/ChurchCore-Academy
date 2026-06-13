# ADR 0017: Session-Derived Academy Identity

Date: 2026-06-13
Status: accepted

## Context

Academy API routes currently accept bootstrap identity headers and may assign institution-administrator authority when role input is missing. Caller-controlled identity is unsuitable for student records, grades, transcripts, billing, financial aid, or LMS operations.

## Decision

Production Academy identity is derived only from a verified Supabase user session. The Supabase subject maps to an Academy person through an active `academy_account_links` record. Tenant and roles are loaded from active, date-valid persisted role assignments.

Missing account links, missing roles, and ambiguous active tenant memberships fail authentication. No role defaults to `institution_admin`.

Bootstrap headers are restricted to explicit local development on loopback hosts when `NODE_ENV` is not `production` and `ACADEMY_LOCAL_BOOTSTRAP_ENABLED=true`.

## Consequences

Routes can no longer be tested or operated by adding identity headers alone. Local development requires seeded account links or explicit local bootstrap mode. Authentication failures become distinguishable from authorization failures.

## Alternatives Considered

JWT custom claims as the sole role source:

- rejected because role changes and revocation would depend on token refresh and duplicate Academy authorization state.

Caller-supplied reverse-proxy headers:

- rejected because this repository does not have a trusted gateway contract that cryptographically binds those headers.

Persisted Academy membership resolved from a verified session:

- accepted because it supports immediate revocation, tenant checks, and auditable role state.

## Review Notes

- Product boundary: Academy owns Academy person, tenant, and role membership.
- Security/privacy: request headers cannot grant production identity or authority.
- Testing: session, missing-link, inactive-role, ambiguous-tenant, and local-bootstrap tests are required.
- Rollback: reverting requires disabling production traffic because the previous behavior is insecure.
