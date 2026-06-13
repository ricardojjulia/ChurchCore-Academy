# Release 2 Slice 1 Admissions Verification

Date: 2026-06-13
Status: implemented and branch-verified

## Implemented

- pre-student application domain and deterministic state transitions;
- explicit applicant and staff authorization;
- tenant-scoped application and immutable event storage;
- composite tenant foreign keys for person, program, term, decision actor, and event ownership;
- forced RLS for applications and events;
- idempotent create, submit, and decision mutations;
- append-only application events and redacted global audit events;
- authenticated list, detail, create, submit, and decision APIs;
- persistent staff review page at `/admissions`;
- explicit authentication and authorization denied states.

## Verification evidence

- `npm test`: 356 tests passed.
- `npm run lint`: passed.
- `npm run build`: passed with Next.js 16.2.7.
- `git diff --check`: passed.
- `npm audit`: zero known vulnerabilities.
- Focused admissions tests cover validation, policy, transitions, repository SQL, service idempotency, migration requirements, API error handling, review-model exposure, and page denied states.
- The Release 1 security migration and admissions migration execute together inside `BEGIN`/`ROLLBACK` against configured Postgres.
- `scripts/verify-admissions-rls.ts` validates unauthenticated denial, applicant self read/submit, unrelated applicant denial, same-tenant staff acceptance, cross-tenant staff denial, composite tenant-reference rejection, and terminal application immutability using real database roles.
- Browser verification confirms `/admissions` renders meaningful content, has no Next.js error overlay, includes the Admissions navigation item, and shows `Authentication required` without a session.

## Open release gates

- Browser verification with seeded signed-in applicant and admissions-staff Supabase sessions remains required before production approval.
- Accepted-application conversion to student, enrollment, and registration records is not implemented.
- Registration transactions, attendance, faculty grade entry, transcript issuance, billing, payments, financial aid, reporting/exports, communications, persistent Student PWA workflows, and executable LMS workers remain planned.
- This slice does not complete the Release 2 exit gate or make the full product production-ready.
