# ADR 0018: Postgres RLS And Request Database Context

Date: 2026-06-13
Status: accepted

## Context

Application repositories filter by tenant, but most Academy tables do not enforce row-level security. A missed filter or direct Supabase query could expose records across institutions.

## Decision

Every Academy-owned table will enable and force Postgres row-level security. Policies derive the authenticated external subject, Academy person, tenant memberships, roles, student self-scope, and guardian relationships from persisted records.

Request-facing direct Postgres access runs inside a transaction that sets local verified identity context. Background workers use a separately named privileged path and require an explicit tenant for every operation.

Application-level policy checks remain defense in depth.

## Consequences

Repositories must run with request context and tests must exercise policy behavior. Migrations and controlled workers require explicit privileged connections. Incorrect policy deployment can deny legitimate traffic, so migrations require real database verification.

## Alternatives Considered

Application filters only:

- rejected because one omitted predicate defeats tenant isolation.

One database schema per tenant:

- rejected for the MVP because migration, reporting, and operational complexity are disproportionate.

Shared schema with RLS:

- accepted because it matches Supabase, preserves shared migrations, and enforces the boundary at the database.

## Review Notes

- Product boundary: policies protect Academy-owned records only.
- Security/privacy: tenant isolation is enforced even when application checks fail.
- Testing: every table family requires unauthenticated, same-tenant, cross-tenant, self, guardian, and staff cases where applicable.
- Rollback: use a forward-fix migration; do not disable RLS in production.
