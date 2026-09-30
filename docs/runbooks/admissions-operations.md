# Admissions Operations Runbook

## Access prerequisites

Applicants require:

1. a verified Supabase user;
2. an active Academy account link to one person and tenant;
3. an active tenant-scoped `applicant` role.

Reviewers require an active `admissions`, `registrar`, `dean`, or `institution_admin` role.

## Public application portal routes

Signed-out public application endpoints resolve their tenant from published records in `academy_public_institution_routes`.

Supported route types:

- `host`: a lowercase host without a port, such as `apply.example.edu`.
- `slug`: a lowercase public slug, such as `churchcore-academy`, passed as `?institution=churchcore-academy` or `?school=churchcore-academy`.

Do not use `?tenant=` for public application links. Public routes intentionally ignore it.

Before enabling a public application portal for an institution:

1. Confirm the target `tenant_id` exists in `academy_institution_profiles`.
2. Confirm the host or slug is lowercase, trimmed, and has no port.
3. Insert or update the mapping with `published_at = now()` only after the admissions owner approves the public link.
4. Verify `/apply` or `/apply?institution=<slug>` loads programs without authentication.
5. Submit a test application, check `/apply/status`, and confirm admissions staff can see the application while another tenant cannot.
6. Record the mapping, approval, verification command or browser evidence, and rollback instruction in the PR or run record.

To disable a public route, set `published_at = null` rather than deleting the row. Deleting is reserved for mappings created in error.

## Application lifecycle

1. Create a draft through `POST /api/academy/admissions/applications` with an `Idempotency-Key`.
2. Submit the owned draft through `POST /api/academy/admissions/applications/:id/submit`.
3. Reviewers inspect persistent records at `/admissions` or through the authenticated APIs.
4. Record `accepted` or `declined` through `POST /api/academy/admissions/applications/:id/decision`.
5. Confirm the accepted application has an application term.
6. Convert through `POST /api/academy/admissions/applications/:id/convert` with an `Idempotency-Key`, or use **Convert to student** at `/admissions`.
7. Confirm the row displays the assigned student number.

Conversion is limited to `admissions`, `registrar`, and `institution_admin`. Deans may review and decide applications but cannot activate student identity.

The transaction creates:

- an active student role while retaining the applicant role;
- one student profile and tenant-scoped student number;
- one active program enrollment;
- one academic-period registration;
- immutable conversion and global audit events.

Do not manually create these records or use conversion to create course-section registration, billing, aid, LMS, or Student PWA release records.

## Duplicate requests

- Reuse the original idempotency key only when retrying the same mutation on the same application.
- A replay returns the existing mutation result without another application event or global audit event.
- Reusing a key for another application or action returns `409`.

## Withdrawal and incorrect decisions

- The domain supports withdrawal from `draft`, `submitted`, or `under_review`; its API/UI is deferred.
- Accepted and declined applications are terminal in this slice.
- Do not update or delete application events.
- An incorrect decision requires an approved forward-event correction design and audit trail. Do not edit database history.

## Access revocation

1. Disable the Academy account link or role assignment.
2. Revoke active Supabase sessions when immediate access removal is required.
3. Confirm the user receives `401` or `403`.
4. Review audit events for activity after the revocation time.

## Incident response

1. Preserve application and audit events.
2. Record tenant, person, application, correlation ID, and idempotency key.
3. Disable affected account links or roles.
4. Check for cross-tenant reference failures and repeated mutation keys.
5. Restore service through a reviewed forward migration or event; never rewrite immutable events.

## Verification

Run the database role matrix against a configured local database:

```bash
npm run verify:admissions-rls
npm run verify:enrollment-conversion-rls
```

Both scripts run entirely inside rolled-back transactions.
