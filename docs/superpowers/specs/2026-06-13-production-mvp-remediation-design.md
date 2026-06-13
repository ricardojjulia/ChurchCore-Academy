# ChurchCore Academy Production MVP Remediation Design

Date: 2026-06-13
Status: approved architecture

## Factory Intake

Product area: Production MVP hardening and competitive workflow completion.

Primary users:

- platform administrators
- institution administrators
- admissions staff
- registrars
- faculty and instructional staff
- financial-aid staff
- billing staff
- students and guardians

Institution modes affected:

- Bible schools and ministry training institutes
- children's schools
- seminaries
- colleges and universities
- mixed-mode institutions

Data touched:

- authentication identities and role assignments
- tenant configuration and audit records
- student, guardian, faculty, admissions, enrollment, grading, transcript, billing, payment, and financial-aid records
- LMS credentials, mappings, operations, and reviewed imports
- reports, exports, messages, and delivery events

LMS impact: Moodle and Canvas operations move from contract planning to executable provider clients while Academy remains the system of record.

Student PWA impact: placeholder routes become authenticated, persistent, student-scoped read surfaces.

ShepherdAI impact: recommendations may consume reviewed Academy-owned admissions, enrollment, academic, billing-hold, SAP, and communication-state signals. It may not consume raw payment credentials, raw federal files, provider secrets, counseling data, giving data, devotional activity, or inferred spiritual condition.

Auth and privacy risk: critical. The program handles education records, minors, payment records, federal student-aid data, grades, transcripts, guardian relationships, and external-provider credentials.

## Problem Statement

ChurchCore Academy has strong domain modeling, tests, provider-neutral LMS contracts, and a usable demonstration surface. It is not ready for production student records because:

1. Most Academy APIs trust caller-supplied bootstrap headers and may default to institution-administrator authority.
2. Academy tables do not consistently enforce tenant isolation through Postgres row-level security.
3. Important pages and workflow evaluation can silently fall back to seeded mock data.
4. Student courses, schedule, and messages are placeholders.
5. LMS integration paths primarily construct plans instead of executing provider operations.
6. Admissions, enrollment, attendance, grade entry, billing, financial aid, transcript issuance, reporting, and communications do not form complete operational workflows.

The goal is a production-safe, design-partner MVP with a complete institutional golden path, followed by certification-ready federal-aid workflows with sandbox connectors and explicit production activation gates.

## Delivery Strategy

Use phased vertical slices. Each work package must produce independently testable software and pass its own security and data-boundary review.

The program must not attempt to land all domains in one migration, route file, or release. Security foundations are release blockers for every later package.

### Release 1: Production Security Foundation

1. Supabase-session authentication for every Academy API and protected page.
2. Server-derived tenant and Academy person identity.
3. Database-backed active role resolution.
4. RLS on all Academy-owned tables.
5. Service-role access restricted to migrations, controlled jobs, and provider workers.
6. Immutable security and domain audit events.
7. Production prohibition on mock fallbacks and bootstrap identity headers.

Exit gate: an unauthenticated or cross-tenant request cannot read or mutate Academy data through API, server component, direct Supabase access, or background-job paths.

### Release 2: Persistent Academic MVP

1. Persistent dashboard and record loaders.
2. Student PWA courses, schedule, documents, progress, messages, grades, and LMS launch.
3. Admissions application-to-acceptance workflow.
4. Enrollment and section registration.
5. Faculty attendance and grade entry.
6. Registrar-reviewed grade posting.
7. Operational transcript request, generation, hold, issue, and audit workflow.

Exit gate: an institution can admit a student, enroll the student, record attendance and grades, release results, and issue an audited transcript without mock data.

### Release 3: Operational Finance MVP

1. Tuition schedules and fee rules.
2. Student accounts, charges, credits, invoices, and account statements.
3. Stripe PaymentIntent and webhook integration.
4. Payment plans and installment schedules.
5. Institutional scholarships and grants.
6. Manual aid awards, disbursement schedules, refunds, and ledger posting.
7. Billing and financial-aid roles separated from academic-record roles.

Exit gate: a school can assess tuition, accept payment, apply institutional aid, reconcile the student account, and expose a safe student statement.

### Release 4: Regulated Financial Aid

1. Encrypted federal integration configuration.
2. ISIR import, validation, correction workflow, and immutable source-file evidence.
3. Aid-year applications, budgets, cost of attendance, need analysis, packaging, and offer acceptance.
4. Satisfactory Academic Progress evaluation and appeal workflow.
5. COD sandbox message generation, submission tracking, acknowledgements, rejects, and reconciliation.
6. Title IV disbursement authorization, scheduled disbursement, return/refund workflow, and audit evidence.
7. Production activation checklist requiring institutional identifiers, approved credentials, staff authorization, connector certification, and compliance sign-off.

Exit gate: sandbox certification scenarios pass end to end. Production connector activation remains impossible until all institutional prerequisites are recorded and approved.

### Release 5: Provider Execution And Communications

1. Moodle External Services client.
2. Canvas REST client and OAuth/token lifecycle.
3. Executable course provisioning, roster/enrollment synchronization, grade/progress retrieval, retries, idempotency, and reconciliation.
4. Email, SMS, and in-app delivery adapters.
5. Template, consent, preference, suppression, retry, and delivery-event tracking.
6. Operational reports and CSV exports.

Exit gate: provider and communication operations execute through auditable outbox jobs, recover from transient failures, and never expose secrets or raw provider payloads to user-facing records.

## Architecture

### Identity And Authorization

All request identity must originate from a verified Supabase session. API routes and protected server components call one shared resolver that:

1. verifies the Supabase user;
2. resolves the Academy account link by provider and external subject;
3. loads active, date-valid role assignments;
4. derives the tenant from persisted membership;
5. returns an `AcademyActor` with no caller-controlled authority fields.

Bootstrap headers remain available only when all of these conditions are true:

- `NODE_ENV` is not `production`;
- an explicit local bootstrap flag is enabled;
- the request is made through a local development path;
- the resolved response is visibly marked as development bootstrap.

No missing role may default to `institution_admin`. Missing or invalid identity returns `401`; insufficient permission returns `403`.

### Tenant Isolation And RLS

Every Academy table must enable and force RLS. Policies use database helper functions that derive:

- authenticated external subject;
- linked Academy person;
- active tenant memberships;
- active Academy roles;
- student self-scope;
- guardian relationship scope;
- platform staff scope where applicable.

Application-level tenant checks remain defense in depth. RLS is the final database boundary.

Direct Postgres repositories must run with explicit tenant context and must not use a globally unrestricted service role for request handling. Background workers use a separate privileged connection and still require an explicit tenant argument for every operation.

### Persistent Data Boundary

Production loaders must fail closed when persistence is unavailable. Seeded data is allowed only in tests, explicit demo mode, and local seed commands.

The runtime uses dependency-injected repositories:

- Postgres repositories in production and normal development;
- in-memory repositories in unit tests;
- explicit demo repositories only when demo mode is enabled.

There is no catch-and-fallback from a database error to mock student data.

### Domain Modules

New modules follow existing repository conventions:

- `admissions`
- `enrollment`
- `attendance`
- `faculty-grade-entry`
- `billing`
- `financial-aid`
- `federal-aid`
- `transcripts`
- `reporting`
- `communications`
- `audit`
- `provider-runtime`

Each module owns types, validation, service rules, repository interfaces, Postgres implementation, API helpers, tests, and migration references.

### Operational Workflow Pattern

High-value mutations use:

1. authenticated command;
2. domain validation;
3. transaction with tenant-scoped writes;
4. immutable audit event;
5. outbox event for external side effects;
6. idempotency key;
7. safe response without secret or raw external payload data.

This pattern applies to payments, communications, LMS operations, transcript issuance, federal submissions, and aid disbursements.

### Student PWA

The Student PWA reads purpose-built student-scoped models. It never reads raw domain tables directly.

Required surfaces:

- dashboard
- courses and sections
- schedule and academic dates
- released grades and academic progress
- documents and outstanding requirements
- messages and action notices
- registration status
- student account statement and payment actions
- financial-aid offer and status
- transcript requests and issued documents
- provider-neutral LMS launch

Guardian visibility is independently filtered by relationship status, authority, category visibility, release state, and student age/institution policy.

### LMS Provider Runtime

Provider clients live behind the existing provider-neutral contract.

The route layer does not call Moodle or Canvas directly. It creates an Academy operation record and outbox job. A provider worker:

1. resolves encrypted tenant credentials;
2. executes the provider call;
3. records redacted request/response metadata;
4. applies retry and rate-limit policy;
5. stores mapping or reviewed-import results;
6. emits reconciliation and audit events.

Grade and progress results remain pending reviewed imports. They cannot directly become official grades, transcripts, standing decisions, or student-visible records.

### Billing And Payments

The Academy ledger is the financial source of truth. Stripe is a payment processor, not the ledger.

Core records:

- tuition schedules and fee rules
- student accounts
- charges and credits
- invoices and invoice lines
- payment intents and payments
- refunds
- payment plans and installments
- ledger entries
- account holds

Stripe webhook events are signature-verified, deduplicated, tenant-linked through internal metadata, and applied transactionally.

### Financial Aid And Federal Boundary

Institutional aid and federal aid share student-account posting contracts but remain separate domains.

Institutional aid supports scholarships, grants, manual awards, acceptance, scheduled disbursements, and cancellation.

Federal aid adds:

- aid years
- ISIR transactions and correction history
- cost-of-attendance budgets
- eligibility and packaging
- SAP evaluations and appeals
- COD document/message lifecycle
- disbursement and return calculations
- reconciliation evidence

Sensitive federal source files and credentials are encrypted outside ordinary domain columns. User-facing screens receive normalized, minimum-necessary fields.

Federal calculations remain deterministic and versioned. ShepherdAI may recommend staff review but cannot decide eligibility, package aid, authorize disbursement, or submit federal records.

### Reporting And Exports

Reports use approved read models and explicit field allowlists. Export jobs record requester, tenant, report type, filters, row count, purpose, expiration, and download events.

Initial reports:

- enrollment and retention
- section rosters and attendance
- grade submission and posting status
- transcript issuance
- accounts receivable and aging
- payments and refunds
- institutional aid
- SAP and federal-aid workflow status
- LMS reconciliation
- communication delivery

### Communications

Communications use templates and an outbox. Delivery adapters initially support email, SMS, and in-app messages.

The system tracks:

- template version
- recipient and permitted contact channel
- consent and preferences
- message purpose
- rendered-content hash
- provider delivery identifier
- delivery, bounce, suppression, and failure state

Academic, billing, admissions, and aid messages require role-authorized initiation. Bulk sends require preview and confirmation.

## Data Migration Strategy

Migrations are append-only and grouped by work package.

1. Add auth membership helpers, audit tables, and RLS policies.
2. Add admissions and enrollment tables.
3. Add attendance, grade-entry, and transcript-operation tables.
4. Add billing ledger and payment tables.
5. Add institutional financial-aid tables.
6. Add federal-aid and connector-state tables.
7. Add provider operation/outbox tables.
8. Add communications and report-job tables.

Every migration package includes:

- schema tests;
- tenant and foreign-key constraints;
- RLS policy tests;
- rollback/forward-fix notes;
- local seed changes where needed;
- migration ordering checks.

## Error Handling

- Authentication failures return `401`.
- Authorization and tenant failures return `403` without revealing record existence.
- Validation failures return structured `400` responses.
- Conflicts and duplicate idempotency keys return `409`.
- External-provider failures return safe operation status and correlation identifiers.
- Database failures never trigger mock fallback.
- Raw Stripe, Moodle, Canvas, ISIR, COD, email, or SMS payloads never appear in client errors or general application logs.

## Verification Strategy

Each package uses TDD and must pass focused tests before the global gate.

Required global gate:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Additional gates:

- auth tests proving headers cannot grant roles or change tenants;
- RLS tests using authenticated database claims;
- migration execution in a real local Postgres transaction;
- browser verification for administrator, faculty, student, guardian, billing, and aid workflows;
- Stripe signature and webhook replay tests;
- Moodle and Canvas mocked-provider contract tests plus sandbox smoke tests;
- ISIR parser fixture tests with synthetic data only;
- COD sandbox scenario and reconciliation tests;
- accessibility checks for critical forms and tables;
- security review for every work package;
- release checklist proving production has no mock fallback or development bootstrap identity.

## Documentation Artifacts

The program requires:

- one implementation plan per release/work package;
- ADRs for session identity, RLS, audit/outbox, billing ledger, federal-aid boundary, provider execution, communications, and export controls;
- updated architecture and security documentation;
- updated master plan and factory roadmap;
- operational runbooks for auth, migrations, payments, provider credentials, federal sandbox activation, communications, backups, incident response, and tenant offboarding;
- updated README with honest implemented-versus-planned status;
- reviewer checklists for FERPA/student data, payments, and Title IV workflows.

## Explicit Non-Goals

- No claim of federal certification or production eligibility without institutional approval and connector certification.
- No automatic financial-aid eligibility or disbursement decisions by ShepherdAI.
- No direct LMS write from user-facing route handlers.
- No storage of payment card data.
- No raw federal file display to general Academy users.
- No production support for caller-supplied identity headers.
- No silent fallback to mock or seeded data.
- No attempt to reproduce an LMS course-delivery runtime inside Academy.

## Program Completion Criteria

The remediation program is complete only when:

1. security foundation gates pass;
2. the academic golden path runs on persistent tenant-isolated data;
3. operational finance runs against the Academy ledger and Stripe sandbox/production configuration;
4. regulated aid passes approved synthetic sandbox scenarios and remains production-gated;
5. Moodle and Canvas provider operations execute through workers with retries and reconciliation;
6. Student PWA contains no MVP placeholder routes;
7. required reports and communications execute through audited jobs;
8. all docs describe actual implementation status without roadmap drift;
9. full automated, migration, browser, and security verification evidence is recorded.
