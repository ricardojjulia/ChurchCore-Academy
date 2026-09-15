# Story: Public Applicant Portal

**ID:** T1-03
**Tier:** 1 — Unblock Basic Operations
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story

As a prospective student, I want to submit an application to a faith-based institution through a
public web form without needing an account, so that I can begin my enrollment journey from the
institution's website without barriers.

As a staff member, I want newly submitted public applications to appear in the admissions review
queue immediately after submission, so that I never have to monitor a separate intake channel or
manually import records.

So that: ChurchCore Academy has an actual intake funnel. Today `/admissions` redirects to the
staff admin page. No prospective student has a path to apply.

## Background

The admissions module already has a complete `PostgresAdmissionsRepository` with `create`,
`transition`, `appendEvent`, and `findByIdempotencyKey` methods, and the `academy_admission_applications`
table supports the full status lifecycle (`draft` → `submitted` → `under_review` → `accepted` /
`rejected` → `converted`). The `AdmissionApplication` type captures `legal_name`, `email`,
`phone`, `program_id`, `application_term_id`, and a full event log in
`academy_admission_application_events`.

What is missing is any public-facing route. The current `/admissions` page requires authentication
and redirects unauthenticated users to `/login`. There is no `/apply` route, no public form, no
status-check token, and no confirmation email trigger. Every competitor (Populi, Sycamore, FACTS)
has a self-service applicant portal; ChurchCore Academy does not.

## Acceptance Criteria

1. The `/apply` route is publicly accessible without authentication. No login or account required.
2. The `/apply` form collects and validates: legal name (required), email address (required, valid
   format), phone number (optional), program interest (required, selected from a published list of
   active programs for the tenant), start term (required, selected from active/upcoming terms),
   personal statement (required, minimum 50 characters, maximum 3000 characters), and a honeypot
   field hidden from real users (see Edge Cases).
3. On submission, the API creates an `academy_admission_applications` record with `status = 'submitted'`
   and an `academy_admission_application_events` row with `event_type = 'submitted'`.
4. The API returns a status-check token (UUID v4) stored on the application record. The applicant
   is redirected to a confirmation page that displays the token and instructs them to save it.
5. The applicant receives a confirmation email (via the communications queue, template
   `admissions_decision` or a new `application_received` template) containing their application
   reference number and a link to `/apply/status?token=<token>`.
6. The `/apply/status?token=<token>` page is publicly accessible without authentication and shows
   only: current status (submitted / under review / accepted / rejected), submitted date, and
   program name. It never shows internal staff notes, decision reasons, or other applicants' data.
7. A staff member visiting `/admin/admissions` sees newly submitted public applications in the
   review queue within one page load of submission (no polling delay; the record is created
   synchronously before the API returns).
8. Submitting from the same email address a second time returns the existing application's status
   page redirect and does not create a duplicate record (idempotent by email + tenant).
9. The API enforces a rate limit of 3 submission attempts per IP address per 24-hour window.
   Requests exceeding the limit receive a 429 response with a friendly message.
10. The form validates program and term against the tenant's published data. Submitting an
    unknown program ID or a past term returns a validation error.

## Edge Cases

- Duplicate submission from the same email: on `POST /api/public/apply`, if an application for
  the same email already exists for this tenant, return a 200 with a redirect to the status page
  using the existing token. Do not create a second record. Log the duplicate attempt.
- Rate limiting: use IP-based sliding window (3 per 24h). Store counts in a lightweight mechanism
  appropriate for Vercel (edge KV or an `academy_rate_limits` table). If Vercel KV is not
  available, fall back to a short-lived Postgres table. ADR-0041 must document the choice.
- Applicant submits for the wrong tenant (wrong subdomain or URL): the `/apply` route must be
  tenant-scoped. Display a friendly error message with the institution contact email if the tenant
  cannot be resolved from the request origin. Never expose another tenant's program list.
- Spam submissions with honeypot field populated: silently return a 200 (fake success) without
  creating a record. Log the honeypot trigger for monitoring.
- Personal statement too short or too long: return a field-level validation error; do not lose the
  rest of the form data.
- Applicant visits `/apply/status?token=<token>` with an unknown or expired token: display a
  neutral "application not found" message without indicating whether any application exists for
  that email.
- Confirmation email delivery failure: the application record is still created and the token is
  still issued. Email failure must not roll back the application. The applicant's confirmation
  page always shows the token even if email failed.
- No active programs configured for the tenant: display a message directing the prospective
  student to contact the institution directly rather than showing an empty form.

## Out of Scope

- Document upload at submission time (Tier 2, T2-02).
- Payment of an application fee (Tier 2, T2-01 Stripe).
- Applicant account creation or self-service portal beyond status checking.
- CRM pipeline, inquiry drip sequences, or conversion tracking (Tier 4, T4-08).
- Personal statement file upload or rich text (plain text only for T1).
- Multi-step wizard form with save-and-resume (all fields on one page for T1).
- CAPTCHA integration (honeypot is sufficient for T1; CAPTCHA is Tier 2).

## Security

- The `/apply` and `/apply/status` routes require no session. They are the only routes in the
  application that are intentionally unauthenticated.
- The status-check token is a UUID v4 generated server-side. It is not derived from applicant PII.
  It is stored on the application record and never logged.
- The status page exposes: current status, submitted date, program name. It must never expose the
  applicant's personal statement, staff notes, decision rationale, or other applicants' data.
- The tenant must be resolved from the subdomain or a published slug — never from a request body
  parameter that could be manipulated to access a different tenant's form or program list.
- All validation occurs server-side. Client-side validation is for UX only.
- The honeypot field must have a plausible name (e.g., `website` or `middle_name`) and must be
  hidden via CSS, not `type="hidden"`, to catch basic bots.

## Role Matrix

| Actor | Submit application | View own status | View all applications | Review/decide on applications |
|-------|:-----------------:|:---------------:|:---------------------:|:-----------------------------:|
| Unauthenticated public | Yes | Yes (via token) | No | No |
| institution_admin | No (use staff create) | Yes | Yes | Yes |
| registrar | No (use staff create) | Yes | Yes | Yes |
| admissions | No (use staff create) | Yes | Yes | Yes |
| academic_admin | No | No | Yes (read-only) | No |
| faculty | No | No | No | No |
| student | No | No | No | No |
| guardian | No | No | No | No |

## Technical Notes

- Key files to read before implementation:
  - `src/modules/admissions/postgres-repository.ts` — `create`, `transition`, `appendEvent`,
    `findByIdempotencyKey`; also check `findMutationByIdempotencyKey` for dedup pattern
  - `src/modules/admissions/types.ts` — `AdmissionApplication`, `CreateAdmissionApplicationInput`,
    `AdmissionApplicationStatus`
  - `src/modules/communications/service.ts` — `createCommunication`, template rendering; add a
    new `application_received` template key or reuse `admissions_decision` with a "received" status
  - `src/app/admin/admissions/` — existing staff admissions page for queue reference
- The `/apply` form must be a standalone Next.js page under `src/app/apply/page.tsx` with its own
  layout that does not include the `AdminShell` or auth guards.
- The public API route `POST /api/public/apply` must NOT use `withAcademyDatabaseContext` (which
  requires an authenticated actor). It must use the service-role Supabase client or a dedicated
  public-application function that enforces its own tenant validation before database access.
- Tenant resolution for the public form: define a public tenant resolver that maps the request
  origin/subdomain to a `tenant_id` without requiring a session. This is a new utility not covered
  by any existing auth helper.
- The `status_token` column needs to be added to `academy_admission_applications` if it does not
  already exist. Check migrations before adding (migrations are append-only).
- A new `application_received` template key must be added to: the `CommunicationTemplateKey` type
  union, the `templates` constant in `communications/service.ts`, and the `template_key` check
  constraint in a new migration.
- ADR-0041 must be written before implementation and must document: public auth boundary, tenant
  resolution approach, rate limiting strategy, and spam control choice.

## Tests Required

- `src/modules/admissions/__tests__/public-application.test.ts`:
  - Success: valid submission creates an application with `status = 'submitted'` and an event row.
  - Success: status-check token is a non-empty string different from the application ID.
  - Duplicate email dedup: second submission with same email returns the existing application
    without creating a new record.
  - Validation: missing legal name returns a validation error; application is not created.
  - Validation: personal statement under 50 characters returns a validation error.
  - Validation: personal statement over 3000 characters returns a validation error.
  - Cross-tenant isolation: submitting with a program ID belonging to a different tenant returns
    a validation error.
  - Honeypot populated: submission with honeypot field returns 200 but no record is created.
  - Status page: token lookup returns status, submitted date, and program name only.
  - Status page unknown token: returns a "not found" response without leaking data.
