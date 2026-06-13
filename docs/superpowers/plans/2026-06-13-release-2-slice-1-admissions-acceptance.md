# Release 2 Slice 1 Admissions Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent, tenant-isolated admissions workflow that creates an application, submits it for review, records a staff decision, and produces an auditable accepted application ready for enrollment conversion.

**Architecture:** A focused `admissions` module owns application types, validation, state transitions, repository contracts, and transactional service rules. Request handlers resolve a verified Academy actor, execute through `withAcademyDatabaseContext`, and write the application plus immutable audit event in the same transaction. Postgres RLS limits applicant self-service to the linked person and permits admissions staff, registrars, deans, and institution administrators to review records.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL/Supabase RLS, `pg`, node:test, ESLint.

---

## File Structure

- `src/modules/admissions/types.ts`: application, status, requirement, decision, and command contracts.
- `src/modules/admissions/validation.ts`: normalized input and transition validation.
- `src/modules/admissions/policy.ts`: admissions role and applicant self-service authorization.
- `src/modules/admissions/postgres-repository.ts`: tenant-scoped application persistence and row mapping.
- `src/modules/admissions/service.ts`: create, submit, accept, and decline transaction rules with audit events and idempotency.
- `src/modules/admissions/__tests__/validation.test.ts`: required fields and normalization tests.
- `src/modules/admissions/__tests__/service.test.ts`: transition, tenant, audit, and idempotency tests.
- `src/modules/admissions/__tests__/repository.test.ts`: SQL tenant predicates and row mapping tests.
- `src/modules/admissions/__tests__/migration.test.ts`: schema, constraints, indexes, RLS, and migration ordering tests.
- `supabase/migrations/20260613142628_admissions_applications.sql`: persistent admissions schema and RLS policies.
- `src/app/api/academy/admissions/applications/route.ts`: create and list applications.
- `src/app/api/academy/admissions/applications/[id]/route.ts`: application detail.
- `src/app/api/academy/admissions/applications/[id]/submit/route.ts`: applicant/staff submission.
- `src/app/api/academy/admissions/applications/[id]/decision/route.ts`: authorized staff acceptance or decline.
- `src/app/api/academy/admissions/__tests__/routes.test.ts`: auth, validation, transition, and safe-response tests.
- `src/modules/admissions/review-model.ts`: staff-facing application review model.
- `src/modules/admissions/__tests__/review-model.test.ts`: display-state and minimum-necessary field tests.
- `src/app/admissions/page.tsx`: authenticated admissions queue and review surface.
- `src/components/admissions-application-list.tsx`: accessible application table and status presentation.
- `docs/adr/0020-admissions-application-and-decision-model.md`: accepted admissions model decision.
- `docs/runbooks/admissions-operations.md`: application, submission, decision, revocation, and incident procedures.
- `README.md`, `docs/architecture.md`, `docs/product/factory-roadmap.md`: implemented-versus-planned status.

### Task 1: Admissions Domain Types And Validation

**Files:**
- Create: `src/modules/admissions/types.ts`
- Create: `src/modules/admissions/validation.ts`
- Create: `src/modules/admissions/__tests__/validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Cover:

```ts
test("normalizes a valid draft application");
test("requires tenant, applicant identity, program, legal name, and email");
test("rejects applicant and program identifiers from another tenant context");
test("rejects acceptance fields on a new draft");
test("normalizes email and trims names without retaining arbitrary payload fields");
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --import tsx --test src/modules/admissions/__tests__/validation.test.ts
```

Expected: fail because the admissions types and validators do not exist.

- [ ] **Step 3: Define the domain contracts**

Use these core types:

```ts
export type AdmissionApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "accepted"
  | "declined"
  | "withdrawn";

export interface AdmissionApplication {
  id: string;
  tenantId: string;
  applicantPersonId: string;
  programId: string;
  applicationTermId?: string;
  legalName: string;
  preferredName?: string;
  email: string;
  phone?: string;
  status: AdmissionApplicationStatus;
  submittedAt?: string;
  decidedAt?: string;
  decidedByPersonId?: string;
  decisionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdmissionApplicationInput {
  tenantId: string;
  applicantPersonId: string;
  programId: string;
  applicationTermId?: string;
  legalName: string;
  preferredName?: string;
  email: string;
  phone?: string;
}
```

- [ ] **Step 4: Implement minimal normalization and validation**

`normalizeCreateAdmissionApplicationInput()` must return only allowlisted fields, lowercase email, trim strings, reject missing required fields, and reject decision/status fields supplied through untyped JSON.

- [ ] **Step 5: Verify GREEN**

Run the focused tests. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/modules/admissions
git commit -m "feat(admissions): define application domain rules"
```

### Task 2: Admissions Policy And State Machine

**Files:**
- Create: `src/modules/admissions/policy.ts`
- Create: `src/modules/admissions/transitions.ts`
- Create: `src/modules/admissions/__tests__/policy.test.ts`
- Create: `src/modules/admissions/__tests__/transitions.test.ts`

- [ ] **Step 1: Write failing policy and transition tests**

Assert:

```ts
test("applicants can read and edit only their own draft application");
test("admissions staff can read and review same-tenant applications");
test("students, guardians, and faculty cannot decide applications");
test("cross-tenant actors are denied before repository access");
test("draft applications can be submitted");
test("submitted applications can enter review and be accepted or declined");
test("accepted and declined applications cannot be decided again");
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --import tsx --test src/modules/admissions/__tests__/policy.test.ts src/modules/admissions/__tests__/transitions.test.ts
```

- [ ] **Step 3: Implement authorization**

Use:

```ts
export type AdmissionsAction = "create" | "read" | "submit" | "review" | "decide";
```

Admissions, registrar, dean, and institution-admin roles may review and decide. An applicant may create, read, and submit only when `actor.userId === applicantPersonId` and the tenant matches.

- [ ] **Step 4: Implement deterministic transitions**

`assertAdmissionTransition(current, next)` must allow:

- `draft -> submitted`
- `submitted -> under_review`
- `submitted -> accepted`
- `submitted -> declined`
- `under_review -> accepted`
- `under_review -> declined`
- `draft|submitted|under_review -> withdrawn`

All other transitions throw `Invalid admission application transition.`

- [ ] **Step 5: Verify GREEN and commit**

```bash
git add src/modules/admissions
git commit -m "feat(admissions): enforce application access and transitions"
```

### Task 3: Admissions Schema And RLS

**Files:**
- Create: `supabase/migrations/20260613142628_admissions_applications.sql`
- Create: `src/modules/admissions/__tests__/migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

The test must assert creation of:

```sql
academy_admission_applications
academy_admission_application_events
```

and require:

- tenant foreign keys;
- applicant, program, and optional academic-period references;
- status check constraints;
- unique tenant/idempotency indexes;
- enable and force RLS;
- applicant self policies;
- admissions staff read/write policies;
- append-only event update/delete rejection.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --import tsx --test src/modules/admissions/__tests__/migration.test.ts
```

- [ ] **Step 3: Create the append-only migration**

`academy_admission_applications` stores normalized application identity, target program/term, status, submission and decision metadata, idempotency key, and timestamps.

`academy_admission_application_events` stores application, tenant, actor, event type, previous/next status, redacted notes, correlation ID, idempotency key, and timestamp.

Policies must call `academy_private.academy_current_person_id()`, `academy_private.academy_current_tenant_ids()`, and `academy_private.academy_has_active_role(...)`.

- [ ] **Step 4: Verify migration statically and transactionally**

Run:

```bash
node --import tsx --test src/modules/admissions/__tests__/migration.test.ts
node --env-file=.env.local --input-type=module -e 'import fs from "node:fs/promises"; import pg from "pg"; const sql=await fs.readFile("supabase/migrations/20260613142628_admissions_applications.sql","utf8"); const client=new pg.Client({connectionString:process.env.DATABASE_URL}); await client.connect(); try { await client.query("begin"); await client.query(sql); await client.query("rollback"); console.log("Admissions migration transaction validated."); } finally { await client.end(); }'
```

Expected: static tests pass and the migration executes inside `BEGIN`/`ROLLBACK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260613142628_admissions_applications.sql src/modules/admissions/__tests__/migration.test.ts
git commit -m "feat(admissions): add tenant-isolated application storage"
```

### Task 4: Repository And Transactional Service

**Files:**
- Create: `src/modules/admissions/postgres-repository.ts`
- Create: `src/modules/admissions/service.ts`
- Create: `src/modules/admissions/__tests__/repository.test.ts`
- Create: `src/modules/admissions/__tests__/service.test.ts`
- Modify: `src/modules/audit/postgres-repository.ts`

- [ ] **Step 1: Write failing repository tests**

Assert:

- every read and write includes `tenant_id`;
- application detail returns `undefined` when absent;
- list filters use status without interpolating values;
- row mapping normalizes dates;
- duplicate idempotency returns the existing application.

- [ ] **Step 2: Write failing service tests**

Cover:

```ts
test("creates a same-tenant draft and appends application and global audit events");
test("submits an owned draft exactly once");
test("accepts a submitted application as admissions staff");
test("rejects applicant self-acceptance");
test("rejects cross-tenant commands before writes");
test("rolls back application and audit writes together on failure");
```

- [ ] **Step 3: Verify RED**

Run the repository and service tests.

- [ ] **Step 4: Implement repository methods**

Required methods:

```ts
create(input, actorPersonId, correlationId, idempotencyKey)
findById(tenantId, applicationId)
findByIdempotencyKey(tenantId, idempotencyKey)
list(tenantId, filters)
transition(tenantId, applicationId, expectedStatus, nextStatus, decision)
appendEvent(event)
```

- [ ] **Step 5: Implement service commands**

The service accepts scoped repositories and `PostgresAcademyAuditRepository`. It performs policy checks before repository calls, validates transitions, writes the application event and global audit event in the caller-owned transaction, and never stores raw request JSON.

- [ ] **Step 6: Verify GREEN and commit**

```bash
git add src/modules/admissions src/modules/audit/postgres-repository.ts
git commit -m "feat(admissions): add audited application workflow"
```

### Task 5: Authenticated Admissions APIs

**Files:**
- Create: `src/app/api/academy/admissions/applications/route.ts`
- Create: `src/app/api/academy/admissions/applications/[id]/route.ts`
- Create: `src/app/api/academy/admissions/applications/[id]/submit/route.ts`
- Create: `src/app/api/academy/admissions/applications/[id]/decision/route.ts`
- Create: `src/app/api/academy/admissions/__tests__/routes.test.ts`
- Modify: `src/app/api/academy/api-utils.ts`
- Modify: `src/modules/academy-auth/__tests__/request-database-boundary.test.ts`

- [ ] **Step 1: Write failing route tests**

Assert:

- unauthenticated requests return `401`;
- forbidden roles and cross-tenant access return `403`;
- malformed JSON returns `400`;
- duplicate idempotency returns the existing application;
- invalid transitions return `409`;
- unknown persistence failures return generic `500`;
- responses omit event internals and audit metadata.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --import tsx --test src/app/api/academy/admissions/__tests__/routes.test.ts
```

- [ ] **Step 3: Add a typed conflict error**

Create `AcademyConflictError` in `academy-auth/errors.ts` or a shared domain-error module and map it to `409` in `api-utils.ts`.

- [ ] **Step 4: Implement thin route handlers**

Each route must:

1. resolve `AcademyActor`;
2. parse allowlisted JSON;
3. require `Idempotency-Key` on mutations;
4. create a correlation ID;
5. call `withAcademyDatabaseContext`;
6. instantiate repositories from the scoped client;
7. call the admissions service;
8. return a minimum-necessary response.

- [ ] **Step 5: Extend the request-database boundary test**

Add all admissions repository routes to `requestRepositoryRoutes`.

- [ ] **Step 6: Verify GREEN and commit**

```bash
git add src/app/api/academy src/modules/academy-auth
git commit -m "feat(admissions): expose authenticated application APIs"
```

### Task 6: Admissions Review Model And Staff Surface

**Files:**
- Create: `src/modules/admissions/review-model.ts`
- Create: `src/modules/admissions/__tests__/review-model.test.ts`
- Create: `src/components/admissions-application-list.tsx`
- Create: `src/app/admissions/page.tsx`
- Modify: `src/components/academy-shell.tsx`

- [ ] **Step 1: Write failing review-model tests**

Assert:

- status labels and submitted/decision dates are display-ready;
- queue metrics count draft, submitted/review, accepted, and declined applications;
- applicant contact fields are included only for authorized staff;
- application events, audit metadata, and idempotency keys are excluded.

- [ ] **Step 2: Verify RED**

Run the focused review-model test.

- [ ] **Step 3: Implement the read model and page**

The server page resolves a verified actor, requires admissions review access, loads through `withAcademyDatabaseContext`, and renders:

- status metrics;
- applicant, program, status, submission date, and decision date;
- clear empty state;
- no mutation controls in this first UI slice.

- [ ] **Step 4: Add navigation**

Add `/admissions` to the Academy staff navigation with an admissions-appropriate icon and caption.

- [ ] **Step 5: Verify tests, lint, build, and browser rendering**

Run:

```bash
node --import tsx --test src/modules/admissions/__tests__/review-model.test.ts
npm run lint
npm run build
```

Start the app with configured local credentials and verify the admissions route shows allowed or denied state without seeded records.

- [ ] **Step 6: Commit**

```bash
git add src/app/admissions src/components src/modules/admissions
git commit -m "feat(admissions): add persistent application review surface"
```

### Task 7: ADR, Runbook, Roadmap, And Verification

**Files:**
- Create: `docs/adr/0020-admissions-application-and-decision-model.md`
- Create: `docs/runbooks/admissions-operations.md`
- Create: `docs/superpowers/plans/2026-06-13-release-2-slice-1-admissions-verification.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/product/faith-based-academy-master-plan.md`
- Modify: this plan to check completed tasks

- [ ] **Step 1: Write ADR 0020**

Record:

- application as a pre-student admissions record;
- applicant person link without automatic student activation;
- deterministic status transitions;
- staff decision authority;
- append-only application event plus global audit event;
- enrollment conversion deferred to Release 2 Slice 2.

- [ ] **Step 2: Write the operations runbook**

Include account linking, draft creation, submission, decision, withdrawal, duplicate idempotency, incorrect decision recovery through forward events, access revocation, and incident response.

- [ ] **Step 3: Update product status**

State separately:

- admissions application-to-decision implemented;
- enrollment conversion, registration, attendance, grade entry, transcript issuance, and Student PWA persistence still planned;
- no claim that Release 2 exit gate is complete.

- [ ] **Step 4: Run the full verification gate**

```bash
npm test
npm run lint
npm run build
git diff --check
npm audit
```

- [ ] **Step 5: Run migration and security verification**

Apply both security and admissions migrations in a rollback transaction and test:

- unauthenticated denied;
- applicant self read/submit;
- another applicant denied;
- same-tenant admissions staff allowed;
- cross-tenant staff denied;
- accepted application immutable except through explicit forward event.

- [ ] **Step 6: Record evidence and commit**

```bash
git add README.md docs
git commit -m "docs: record admissions operations and verification"
```

## Slice Completion Criteria

This slice is complete only when:

1. a verified applicant or authorized admissions staff member can create a draft;
2. the applicant can submit only their own application;
3. authorized same-tenant staff can accept or decline;
4. every mutation is tenant-scoped, idempotent, and auditable;
5. RLS blocks unauthenticated, cross-tenant, and unrelated applicant access;
6. the staff review page uses persistent data;
7. no accepted application automatically becomes a student or enrollment;
8. full automated, migration, browser, and security verification evidence is recorded.
