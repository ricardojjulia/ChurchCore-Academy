# Release 2 Slice 2 Enrollment Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert an accepted admissions application exactly once into an active student identity, program enrollment, and academic-period registration.

**Architecture:** Add a focused `enrollment-conversion` domain module whose service owns authorization, eligibility, idempotency, and the single database transaction. PostgreSQL remains the source of truth through tenant-aware foreign keys, forced RLS, immutable conversion events, and row-locked student-number allocation; the admissions API and review UI are thin adapters.

**Tech Stack:** Next.js App Router, TypeScript, React 19, PostgreSQL/Supabase RLS, Node test runner, `pg`.

---

## File Map

- Create `src/modules/enrollment-conversion/types.ts`: conversion command/result and repository contracts.
- Create `src/modules/enrollment-conversion/policy.ts`: role authorization.
- Create `src/modules/enrollment-conversion/eligibility.ts`: accepted/term/not-converted checks.
- Create `src/modules/enrollment-conversion/service.ts`: orchestration, replay handling, and audit.
- Create `src/modules/enrollment-conversion/postgres-repository.ts`: one-transaction persistence.
- Create `src/modules/enrollment-conversion/__tests__/*.test.ts`: domain, service, repository, and migration tests.
- Modify `src/modules/admissions/types.ts`: expose immutable conversion metadata.
- Modify `src/modules/admissions/postgres-repository.ts`: map conversion metadata.
- Create `src/app/api/academy/admissions/applications/[id]/convert/route.ts`: authenticated conversion endpoint.
- Modify `src/app/api/academy/admissions/service-factory.ts`: construct conversion service inside request DB context.
- Modify `src/app/api/academy/admissions/__tests__/routes.test.ts`: route boundary coverage.
- Modify `src/modules/admissions/review-model.ts`: conversion state and action eligibility.
- Modify `src/modules/admissions/page-state.ts`: pass actor role into the model.
- Create `src/components/admissions-conversion-action.tsx`: idempotent client action.
- Modify `src/components/admissions-application-list.tsx`: display conversion state and action.
- Create a CLI-generated migration under `supabase/migrations/`: schema, constraints, triggers, and RLS.
- Create `scripts/verify-enrollment-conversion-rls.ts`: repeatable tenant/role matrix.
- Modify `package.json`: expose the verification command.
- Create `docs/adr/0021-accepted-application-enrollment-conversion.md`: durable architecture decision.
- Modify `README.md`, `docs/architecture/architecture.md`, `docs/product/factory-roadmap.md`, and `docs/runbooks/local-supabase.md`: shipped scope and operations.

### Task 1: Domain Policy And Eligibility

**Files:**
- Create: `src/modules/enrollment-conversion/types.ts`
- Create: `src/modules/enrollment-conversion/policy.ts`
- Create: `src/modules/enrollment-conversion/eligibility.ts`
- Test: `src/modules/enrollment-conversion/__tests__/policy.test.ts`
- Test: `src/modules/enrollment-conversion/__tests__/eligibility.test.ts`

- [ ] **Step 1: Write failing authorization tests**

Cover `institution_admin`, `registrar`, and `admissions` as allowed; cover `dean`, `faculty`, `student`, and cross-tenant actors as denied.

```ts
assert.doesNotThrow(() => assertEnrollmentConversionAccess(actor("registrar")));
assert.throws(
  () => assertEnrollmentConversionAccess(actor("dean")),
  AcademyForbiddenError,
);
```

- [ ] **Step 2: Run policy tests and confirm RED**

Run: `node --import tsx --test src/modules/enrollment-conversion/__tests__/policy.test.ts`

Expected: FAIL because `assertEnrollmentConversionAccess` does not exist.

- [ ] **Step 3: Implement minimal role policy**

```ts
const conversionRoles = new Set(["institution_admin", "registrar", "admissions"]);

export function assertEnrollmentConversionAccess(actor: AcademyActor) {
  if (!conversionRoles.has(actor.role)) {
    throw new AcademyForbiddenError("Enrollment conversion requires admissions or registrar access.");
  }
}
```

- [ ] **Step 4: Write failing eligibility tests**

Cover accepted with a term as eligible, non-accepted as conflict, missing term as conflict, and already-converted as replay-only.

```ts
assert.deepEqual(
  evaluateEnrollmentConversionEligibility(acceptedApplication),
  { kind: "eligible" },
);
```

- [ ] **Step 5: Run eligibility tests and confirm RED**

Run: `node --import tsx --test src/modules/enrollment-conversion/__tests__/eligibility.test.ts`

Expected: FAIL because the evaluator and conversion metadata types do not exist.

- [ ] **Step 6: Add domain types and minimal evaluator**

Define `EnrollmentConversionResult`, `EnrollmentConversionEvent`, `EnrollmentConversionRepository`, and:

```ts
export type EnrollmentConversionEligibility =
  | { kind: "eligible" }
  | { kind: "already_converted" }
  | { kind: "blocked"; reason: string };
```

The evaluator returns `already_converted` when all conversion IDs exist, blocks non-accepted applications, and blocks accepted applications without `applicationTermId`.

- [ ] **Step 7: Run domain tests and commit**

Run: `node --import tsx --test src/modules/enrollment-conversion/__tests__/*.test.ts`

Expected: PASS.

Commit:

```bash
git add src/modules/enrollment-conversion
git commit -m "feat: define enrollment conversion domain"
```

### Task 2: Database Schema, Tenant Constraints, And RLS

**Files:**
- Create: `supabase/migrations/<cli-generated>_accepted_application_enrollment_conversion.sql`
- Test: `src/modules/enrollment-conversion/__tests__/migration.test.ts`

- [ ] **Step 1: Check current Supabase CLI and documentation**

Run:

```bash
npx supabase --version
npx supabase migration new --help
```

Review the current Supabase changelog and RLS documentation before writing SQL.

- [ ] **Step 2: Write a failing migration contract test**

Assert the migration contains:

```ts
assert.match(sql, /create table academy_program_enrollments/i);
assert.match(sql, /create table academy_period_registrations/i);
assert.match(sql, /create table academy_enrollment_conversion_events/i);
assert.match(sql, /create table academy_student_number_sequences/i);
assert.match(sql, /enable row level security/i);
assert.match(sql, /force row level security/i);
assert.match(sql, /converted_at/i);
```

- [ ] **Step 3: Run migration test and confirm RED**

Run: `node --import tsx --test src/modules/enrollment-conversion/__tests__/migration.test.ts`

Expected: FAIL because no Slice 2 migration exists.

- [ ] **Step 4: Generate the migration with the CLI**

Run:

```bash
npx supabase migration new accepted_application_enrollment_conversion
```

- [ ] **Step 5: Implement schema and immutable history**

The migration must:

1. Add nullable conversion metadata to `academy_admission_applications`.
2. Create `academy_program_enrollments` with one active row per tenant/student/program.
3. Create `academy_period_registrations` with one row per tenant/student/academic period.
4. Create `academy_enrollment_conversion_events` with unique `(tenant_id, idempotency_key)` and unique `(tenant_id, application_id)`.
5. Create `academy_student_number_sequences` with one row per tenant and positive `next_value`.
6. Add tenant-aware composite foreign keys for application, person, profile, program, and term references.
7. Add an immutable-event trigger rejecting update/delete.
8. Add an admissions conversion-metadata trigger rejecting rewrites after first assignment.
9. Enable and force RLS on all four tables.
10. Add policies allowing institution admins, registrars, and admissions staff to execute conversion while limiting students to their own enrollment and registration reads.

- [ ] **Step 6: Run migration contracts and local migration**

Run:

```bash
node --import tsx --test src/modules/enrollment-conversion/__tests__/migration.test.ts
npm run db:migrate:local
```

Expected: tests PASS and migration completes in a transaction.

- [ ] **Step 7: Commit schema**

```bash
git add supabase/migrations src/modules/enrollment-conversion/__tests__/migration.test.ts
git commit -m "feat: add enrollment conversion schema"
```

### Task 3: Transactional Repository And Service

**Files:**
- Create: `src/modules/enrollment-conversion/postgres-repository.ts`
- Create: `src/modules/enrollment-conversion/service.ts`
- Test: `src/modules/enrollment-conversion/__tests__/repository.test.ts`
- Test: `src/modules/enrollment-conversion/__tests__/service.test.ts`
- Modify: `src/modules/admissions/types.ts`
- Modify: `src/modules/admissions/postgres-repository.ts`
- Test: `src/modules/admissions/__tests__/repository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Verify one `BEGIN`/`COMMIT` transaction performs these operations in order:

```text
lock application
find replay
lock/increment tenant sequence
insert or reactivate student role
insert student profile
insert program enrollment
insert period registration
stamp application conversion metadata
insert immutable conversion event
```

Also assert any failure triggers `ROLLBACK`, and replay returns the original result without allocating another number.

- [ ] **Step 2: Run repository tests and confirm RED**

Run: `node --import tsx --test src/modules/enrollment-conversion/__tests__/repository.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement the repository transaction**

Expose:

```ts
convert(input: {
  tenantId: string;
  applicationId: string;
  actorPersonId: string;
  convertedAt: string;
  correlationId: string;
  idempotencyKey: string;
}): Promise<EnrollmentConversionResult>;
```

Use a request-owned `pg` client, `SELECT ... FOR UPDATE`, `ON CONFLICT` for the student role, and generated student numbers formatted as `S-000001`.

- [ ] **Step 4: Write failing service tests**

Cover authorization, accepted-state validation, missing term, replay with the same key, conflict when a converted application receives another key, audit emission, and repository errors.

```ts
const result = await service.convert(actor, "application-1", "correlation-1", "key-1");
assert.equal(result.studentNumber, "S-000001");
assert.equal(auditEvents[0].action, "admission.application.converted");
```

- [ ] **Step 5: Run service tests and confirm RED**

Run: `node --import tsx --test src/modules/enrollment-conversion/__tests__/service.test.ts`

Expected: FAIL because `EnrollmentConversionService` does not exist.

- [ ] **Step 6: Implement service and admissions projection**

The service must authorize first, load the tenant-scoped application, evaluate eligibility, require the original idempotency key for replay, call the transactional repository once, and append a redacted global audit event.

Extend `AdmissionApplication` and row mapping with:

```ts
convertedAt?: string;
convertedByPersonId?: string;
studentProfileId?: string;
programEnrollmentId?: string;
periodRegistrationId?: string;
studentNumber?: string;
```

- [ ] **Step 7: Run focused tests and commit**

Run:

```bash
node --import tsx --test src/modules/enrollment-conversion/__tests__/repository.test.ts
node --import tsx --test src/modules/enrollment-conversion/__tests__/service.test.ts
node --import tsx --test src/modules/admissions/__tests__/repository.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/modules/enrollment-conversion src/modules/admissions
git commit -m "feat: convert accepted applications transactionally"
```

### Task 4: Authenticated Conversion API

**Files:**
- Create: `src/app/api/academy/admissions/applications/[id]/convert/route.ts`
- Modify: `src/app/api/academy/admissions/service-factory.ts`
- Modify: `src/app/api/academy/admissions/__tests__/routes.test.ts`

- [ ] **Step 1: Write failing API tests**

Cover:

```text
401 missing verified session
403 unauthorized role
400 missing Idempotency-Key
404 unknown application
409 ineligible or already converted with another key
200 successful conversion
200 same-key replay
```

- [ ] **Step 2: Run route tests and confirm RED**

Run: `node --import tsx --test src/app/api/academy/admissions/__tests__/routes.test.ts`

Expected: FAIL because the convert route is missing.

- [ ] **Step 3: Implement the route**

The route accepts no JSON body, reads `Idempotency-Key`, resolves the verified actor through the established request context, executes inside `withAcademyDatabaseContext`, and returns:

```json
{
  "applicationId": "application-1",
  "studentProfileId": "profile-1",
  "studentNumber": "S-000001",
  "programEnrollmentId": "program-enrollment-1",
  "periodRegistrationId": "period-registration-1",
  "convertedAt": "2026-06-13T..."
}
```

- [ ] **Step 4: Run route and request-boundary tests**

Run:

```bash
node --import tsx --test src/app/api/academy/admissions/__tests__/routes.test.ts
node --import tsx --test src/modules/academy-auth/__tests__/request-boundary.test.ts
```

Expected: PASS and the new route is listed as actor-context protected.

- [ ] **Step 5: Commit API**

```bash
git add src/app/api/academy/admissions src/modules/academy-auth/__tests__/request-boundary.test.ts
git commit -m "feat: expose enrollment conversion API"
```

### Task 5: Admissions Review Conversion UX

**Files:**
- Create: `src/components/admissions-conversion-action.tsx`
- Modify: `src/components/admissions-application-list.tsx`
- Modify: `src/modules/admissions/review-model.ts`
- Modify: `src/modules/admissions/page-state.ts`
- Modify: `src/app/admissions/page.tsx`
- Test: `src/modules/admissions/__tests__/review-model.test.ts`
- Test: `src/modules/admissions/__tests__/page-state.test.ts`

- [ ] **Step 1: Write failing review-model tests**

Assert:

```ts
assert.equal(item.conversionState, "ready");
assert.equal(item.canConvert, true);
assert.equal(converted.conversionState, "converted");
assert.equal(converted.studentNumber, "S-000001");
assert.equal(missingTerm.conversionState, "blocked");
```

- [ ] **Step 2: Run model tests and confirm RED**

Run: `node --import tsx --test src/modules/admissions/__tests__/review-model.test.ts`

Expected: FAIL because conversion fields are absent.

- [ ] **Step 3: Implement model and page-state projection**

Pass actor role to `buildAdmissionReviewModel`. Expose `ready`, `blocked`, `converted`, or `not_applicable`; only authorized staff receive `canConvert: true`.

- [ ] **Step 4: Implement the client action and table state**

The action creates one browser-generated idempotency key, reuses it across retries, POSTs to the conversion endpoint, reports an accessible pending/error state, and refreshes the route on success. The table adds an Enrollment column showing the student number, the conversion button, or the exact block reason.

- [ ] **Step 5: Run focused tests and build**

Run:

```bash
node --import tsx --test src/modules/admissions/__tests__/review-model.test.ts
node --import tsx --test src/modules/admissions/__tests__/page-state.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit UI**

```bash
git add src/components src/modules/admissions src/app/admissions
git commit -m "feat: add admissions enrollment conversion action"
```

### Task 6: Repeatable RLS Matrix And Operational Documentation

**Files:**
- Create: `scripts/verify-enrollment-conversion-rls.ts`
- Modify: `package.json`
- Create: `docs/adr/0021-accepted-application-enrollment-conversion.md`
- Modify: `README.md`
- Modify: `docs/architecture/architecture.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/runbooks/local-supabase.md`

- [ ] **Step 1: Write the RLS matrix verifier**

The script seeds two tenants in a transaction and verifies:

```text
institution_admin: convert in own tenant, denied cross tenant
registrar: convert in own tenant, denied cross tenant
admissions: convert in own tenant, denied cross tenant
dean: denied conversion
student: own enrollment/registration reads only
anonymous: denied
immutable event: update/delete denied
```

Always roll back test data.

- [ ] **Step 2: Add the package command**

```json
"verify:enrollment-conversion-rls": "node --env-file=.env.local --import tsx scripts/verify-enrollment-conversion-rls.ts"
```

- [ ] **Step 3: Run the live matrix**

Run:

```bash
npm run verify:enrollment-conversion-rls
```

Expected: every role/tenant assertion prints PASS and the transaction rolls back.

- [ ] **Step 4: Record architecture and operations**

ADR 0021 must document the single-transaction boundary, retained applicant role, generated student number, immutable events, idempotency semantics, and excluded downstream workflows. Update the roadmap to mark Slice 2 complete only after verification; update the local runbook with migration and matrix commands.

- [ ] **Step 5: Commit verification and docs**

```bash
git add scripts package.json docs README.md
git commit -m "docs: operationalize enrollment conversion"
```

### Task 7: Full Verification And Browser Acceptance

**Files:**
- Modify only if verification exposes a defect, with a failing regression test first.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm test
npm run lint
npm run build
npm run verify:admissions-rls
npm run verify:enrollment-conversion-rls
git diff --check origin/main...HEAD
```

Expected: all commands PASS.

- [ ] **Step 2: Run browser acceptance**

Start the canonical dev server and verify `/admissions` in the in-app Browser:

1. Accepted application with a term shows Convert to student.
2. Accepted application without a term shows the block reason.
3. Successful conversion shows the assigned student number.
4. Refresh does not create a second conversion.
5. Browser console has no application errors.

- [ ] **Step 3: Review the branch diff**

Run:

```bash
git status --short
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Confirm no unrelated files or secrets are included.

- [ ] **Step 4: Commit any verification fixes**

```bash
git add <only-files-fixed-after-a-failing-test>
git commit -m "fix: close enrollment conversion verification gaps"
```

- [ ] **Step 5: Prepare branch completion**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Do not merge or publish until the user chooses the branch-completion option.
