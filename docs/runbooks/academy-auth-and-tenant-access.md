# Academy Authentication And Tenant Access Runbook

Date: 2026-06-13

## Required configuration

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`
- `ACADEMY_LOCAL_BOOTSTRAP_ENABLED=true` only for explicit non-production loopback development
- `DEMO_MODE_ENABLED=true` only for explicit non-production demo data

Never expose a Supabase service-role key to browser code or use it for ordinary request handling.

## Account activation

1. Create or verify the Supabase user.
2. Create an active `academy_people` record in the correct tenant.
3. Create an active `academy_account_links` row with `provider = 'supabase'` and the Supabase user ID as `external_subject`.
4. Create at least one active, date-valid `academy_person_role_assignments` row.
5. Confirm the account resolves to exactly one active tenant and one Academy person.

## Local demo credentials

After applying migrations and running the local seed, these demo accounts are available for `cca-main`:

| Role | Email | Password | Expected route |
| --- | --- | --- | --- |
| Platform and institution admin | `admin@churchcore.academy` | `ChurchCore2026!` | `/` |
| Teacher | `teacher@churchcore.academy` | `ChurchCore2026!` | `/dashboard/faculty/gradebook` |
| Student | `student@churchcore.academy` | `ChurchCore2026!` | `/student` |

The login flow always lands on `/`; use the dashboard navigation or direct route above to verify role-specific surfaces.

## Access failures

- `401`: missing session, missing account link, no active role, or ambiguous active membership.
- `403`: verified identity lacks the required role or tenant scope.
- Empty database results: inspect RLS policies, request-local tenant/person settings, relationship dates, and release status.
- `500`: inspect server logs and correlation data; raw database errors are not returned to clients.

## Local bootstrap

Bootstrap headers are accepted only when all conditions hold:

- `NODE_ENV` is not `production`;
- `ACADEMY_LOCAL_BOOTSTRAP_ENABLED=true`;
- the request host is `localhost`, `127.0.0.1`, or `::1`;
- user, tenant, and at least one role are supplied explicitly.

Never enable this flag in preview or production.

## Revocation

1. Revoke or sign out Supabase sessions when immediate session invalidation is required.
2. Set the account link or person status inactive.
3. End or deactivate role assignments.
4. Verify API access returns `401` or `403`.
5. Review `academy_audit_events` for subsequent attempts.

## RLS incident response

1. Stop affected traffic if cross-tenant access is suspected.
2. Preserve logs, correlation IDs, audit events, and migration state.
3. Reproduce with unauthenticated, tenant A, tenant B, student, guardian, and staff claims.
4. Apply a forward-fix migration. Never edit an already committed migration or disable production RLS as a workaround.
5. Rotate affected credentials and notify institutional owners according to the incident plan.

## Known Release 1 constraints

- The security and enrollment migrations validate through a clean local Supabase reset.
- Live admissions and enrollment-conversion role matrices run inside rolled-back transactions.
- Production approval requires live policy and browser-role verification.
