# ADR 0074: The Proxy Verifies Sessions Locally; Handlers Keep The Revocation Check

Date: 2026-09-25
Status: accepted

## Context

`src/proxy.ts` runs on every request, including every Next.js `<Link>` prefetch, and called
`supabase.auth.getUser()` — a network round trip to Supabase Auth — each time. A production
admin page prefetches 16–22 routes, so one page view cost roughly 20–40 Auth calls before any
page code ran. Under the e2e suite's load this exhausted the local Auth container's database
connections and surfaced as spurious 401s (issue #177). In production it is latency and Auth
rate-limit exposure on every navigation.

## Decision

- The proxy calls `supabase.auth.getClaims()`. With asymmetric signing keys (the Supabase
  default, and what the local stack uses) the JWT is verified locally against the project's
  JWKS; with symmetric keys, supabase-js falls back to `getUser()` itself, so the proxy is never
  less strict than before. `getClaims()` also refreshes an expired session, and the proxy's
  cookie adapter writes the refreshed cookies as before.
- The proxy only decides "signed in or not" (redirect to `/login`, or 401 for `/api/*`).
  Identity for data access still comes from `getUser()` in route handlers and server components
  (`resolveAcademyActorFromSession`, `requireActor`), so a revoked session is still rejected
  before any record is read.

## Consequences

- One Auth round trip per real request (in the handler) instead of one per request *plus* one
  per prefetch.
- A session revoked server-side can still pass the proxy until its JWT expires, but every data
  path re-checks with `getUser()`, so the window only allows reaching a page shell that then
  redirects or denies.
- CLAUDE.md's rule is unchanged: production identity comes only from a verified Supabase
  session.
