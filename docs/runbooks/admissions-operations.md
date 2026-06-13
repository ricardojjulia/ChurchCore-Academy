# Admissions Operations Runbook

## Access prerequisites

Applicants require:

1. a verified Supabase user;
2. an active Academy account link to one person and tenant;
3. an active tenant-scoped `applicant` role.

Reviewers require an active `admissions`, `registrar`, `dean`, or `institution_admin` role.

## Application lifecycle

1. Create a draft through `POST /api/academy/admissions/applications` with an `Idempotency-Key`.
2. Submit the owned draft through `POST /api/academy/admissions/applications/:id/submit`.
3. Reviewers inspect persistent records at `/admissions` or through the authenticated APIs.
4. Record `accepted` or `declined` through `POST /api/academy/admissions/applications/:id/decision`.
5. Do not create enrollment or student records manually from acceptance. That conversion belongs to Release 2 Slice 2.

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
```

The script runs entirely inside a rolled-back transaction.
