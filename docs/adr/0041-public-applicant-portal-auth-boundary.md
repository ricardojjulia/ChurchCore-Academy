# ADR-0041 — Public Applicant Portal Auth Boundary

**Status:** Accepted
**Date:** 2026-06-22
**Deciders:** @ricardojjulia

---

## Context

ADR-0020 defined the admissions application and decision model. ADR-0021 defined accepted-application enrollment conversion. Both decisions assumed applications originate from the staff side — an admin or admissions officer creates the applicant record and begins the workflow.

There is no mechanism for a prospective student to initiate their own application. The Academy has no public intake funnel. Every school using ChurchCore Academy must handle application intake outside the system (paper forms, email, third-party survey tools) and manually key records in. This is a meaningful gap relative to competitive SIS products and blocks the admissions workflow from being a complete end-to-end system.

The design challenge is that a public application route must operate without an authenticated Academy session. The route must remain safe against spam, data harvesting, and tenant confusion (multi-tenant deployment means a public form must resolve the correct institution).

---

## Decision

Add a public `/apply` route and a corresponding public API route `/api/apply`. No Supabase session is required to access or submit these routes.

**Tenant resolution:**

The API route resolves the tenant using the following priority:

1. The request origin domain matched against `academy_institutions.primary_domain`.
2. A `?school=<slug>` query parameter matched against `academy_institutions.slug`.

If no tenant can be resolved, the API returns HTTP 404. The public form may optionally render a school selector if multiple institutions share a deployment and no domain match exists.

**Application submission flow:**

1. Applicant fills out the public form: legal name, email address, program interest (from published program list), and a personal statement (max 2,000 characters).
2. `POST /api/apply` validates input (server-side, Zod schema).
3. Rate-limiting check: Supabase RPC `check_apply_rate_limit(ip, tenant_id)` returns a boolean. Limit is 3 submissions per IP per 24 hours per tenant. If limit is exceeded, return HTTP 429 with a user-facing message (no internal details).
4. If rate limit passes: insert `academy_admissions_applications` row with `status: 'submitted'`, generate a `confirmation_token` (UUID v4), store its SHA-256 hash in the record (never the raw token in the DB).
5. Queue a confirmation email via `CommunicationsService` with the confirmation token embedded in the status URL.
6. Return HTTP 201 with `{ confirmationToken, statusUrl }`. The token is shown once — it is not retrievable after submission.

**Confirmation token and status page:**

Applicants receive a view-only status page at `/apply/status?token=<token>`. The status page:

- Accepts the raw token, hashes it server-side, and looks up the matching application record.
- Displays: applicant name, program interest, submission date, and current status label (`Submitted`, `Under Review`, `Decision Pending`, `Accepted`, `Waitlisted`, `Declined`).
- Does not expose internal IDs, staff notes, decision rationale, or other applicant records.
- Requires no authentication. Access is gated solely by possession of the confirmation token.

**Input validation:**

All fields are validated server-side before any DB write:

- Name: 2–200 characters, no script injection.
- Email: RFC 5321 format.
- Program interest: must match a published program ID from the resolved tenant — no free-text program entry.
- Personal statement: 10–2,000 characters.

**Rate-limiting implementation:**

```sql
create function check_apply_rate_limit(p_ip text, p_tenant_id text)
returns boolean language sql security definer as $$
  select count(*) < 3
  from academy_admissions_applications
  where applicant_ip_hash = encode(sha256(p_ip::bytea), 'hex')
    and tenant_id = p_tenant_id
    and created_at > now() - interval '24 hours';
$$;
```

IP address is never stored raw. Only `encode(sha256(ip::bytea), 'hex')` is stored in `applicant_ip_hash`.

**What the public routes never expose:**

- Other applicants' records or counts
- Staff-side application fields (decision notes, reviewer assignments, workflow state)
- Tenant configuration details beyond the school name and published programs
- Internal database IDs beyond the confirmation token's opaque reference

---

## Consequences

**Positive:**
- Schools have a complete admissions intake funnel from first expression of interest through enrollment conversion.
- The public form is self-service and reduces manual data entry for admissions staff.
- Confirmation tokens give applicants a low-friction way to check status without creating an account.
- Tenant resolution from domain makes the form work naturally on school-specific subdomains.

**Negative:**
- Confirmation tokens are single-use secrets delivered by email. If the confirmation email is undelivered (before ADR-0040 worker is live), the applicant has no path to retrieve their status URL.
- Rate limiting by IP is imperfect — shared NAT or proxies will aggregate multiple applicants under one IP. The 3-per-24-hour limit is conservative enough to be safe while being generous enough for most legitimate use.
- The public form increases the attack surface of the Academy API. The `/api/apply` route must be treated as untrusted input at every layer.

---

## Alternatives Considered

### Require applicants to create a Supabase account before applying

Rejected. Account creation adds friction that causes drop-off before submission. Faith-based schools and Bible programs often recruit from populations unfamiliar with online account management. The application should have the lowest possible barrier.

### Use a third-party form tool (e.g., Typeform, Google Forms) and import

Rejected. External form tools break the Academy admissions workflow, create a manual import step, and cannot enforce program-list validation or queue confirmation emails through the Academy communications system.

### Issue a magic-link login token to applicants

Rejected. Magic-link flows require the applicant to access their email before they can complete the form, adding a round-trip that complicates the submission experience.

---

## Review Notes

- **Security/privacy:** IP addresses must only ever be stored as SHA-256 hashes. Confirmation tokens must only ever be stored as SHA-256 hashes. The raw token is returned in the API response once — it must never be logged.
- **Tenant isolation:** Every DB write and read in `/api/apply` must include `tenant_id` resolved from the domain/slug — never from a request body field.
- **Testing:** Tests must cover: valid submission creates record and queues email, invalid email rejected, program not in published list rejected, rate limit exceeded returns 429, cross-tenant token lookup returns 404, raw token does not appear in DB, IP is stored only as hash.
- **CLAUDE.md rule:** Production identity comes only from a verified Supabase session — this decision is the only authorized exception for the public submission path, and that exception is explicit and scoped.

---

## Related

- ADR-0020 — Admissions Application and Decision Model
- ADR-0021 — Accepted Application Enrollment Conversion
- ADR-0037 — Notification Provider and Retention Boundary
- ADR-0040 — Email Delivery Provider and Queue Worker
- ADR-0003 — Academy Tenant Isolation and Institution Admin Permissions
