# ChurchCore Academy HOWTO

This guide is the practical operator and developer path for running, verifying, and safely changing ChurchCore Academy.

## 1. Run The App Locally

Prerequisites:

- Node.js 24 or newer
- npm 11 or newer
- Docker-compatible runtime
- Supabase CLI

Setup:

```bash
npm install
cp .env.example .env.local
supabase start
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Open:

```text
http://localhost:3200
```

The app intentionally fails closed when there is no verified Supabase session and matching Academy identity. If a protected route redirects to login, check the seeded acceptance personas, Supabase session state, and Academy account links before changing route code.

## 2. Reset Local Data Safely

Use the repo-owned migration and seed commands:

```bash
npm run db:migrate:local
npm run db:seed:local
npm run verify:migration-seed-rehearsal
```

Do not manually delete tenant, person, student, transcript, billing, aid, communication, audit, or provider rows unless a migration or runbook explicitly says to do so. Immutable evidence should be corrected with forward events, not destructive edits.

## 3. Verify The Repository Is Clean

Use this full gate before declaring a branch clean:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected current behavior:

- `npm test` should report all tests passing.
- `npm run lint` should exit 0. Existing warnings may appear, but new work should not add warnings.
- `npm run build` should compile and type-check successfully.
- `git diff --check` should produce no output.

For release-sensitive work, add focused checks:

```bash
npm run verify:migration-seed-rehearsal
npm run verify:role-walkthrough
npm run verify:admissions-rls
npm run verify:enrollment-conversion-rls
npm run verify:llis-consent-rls
```

## 4. Work On A Feature

1. Read the relevant ADR, spec, plan, and runbook before editing.
2. Keep Academy as the academic system of record.
3. Keep provider-specific behavior behind provider boundaries.
4. Keep tenant, role, student, guardian, and record visibility explicit.
5. Add or update tests before claiming behavior is complete.
6. Update durable docs in the same change when behavior, architecture, operations, or release status changes.

Important directories:

```text
src/app/                 Pages and API routes
src/modules/             Domain services, policies, repositories, tests
src/lib/                 Database, Supabase, runtime helpers
supabase/migrations/     Ordered schema and RLS migrations
scripts/                 Verification and local database scripts
docs/adr/                Architecture decisions
docs/runbooks/           Operator procedures
docs/releases/           Release notes and readiness evidence
docs/reviews/            Council reviews and closeouts
```

## 5. Add A Database Migration

Migrations live in `supabase/migrations/`.

Migration expectations:

- Use ordered timestamp filenames.
- Include tenant constraints and indexes where needed.
- Enable and force RLS for tenant-scoped tables.
- Add policies that use the request-scoped tenant context.
- Avoid storing provider secrets or raw provider payloads in domain tables.
- Add migration tests or verifier coverage for high-risk schema changes.
- Prefer forward corrective migrations over destructive rollback.

After migration changes:

```bash
npm run db:migrate:local
npm run db:seed:local
npm run verify:migration-seed-rehearsal
npm test
```

## 6. Activate Providers

Provider activation is not a code shortcut. It is an external release gate.

Before activating payment, email/SMS, Moodle, Canvas, or regulated-aid workflows:

1. Read `docs/runbooks/provider-activation.md`.
2. Confirm tenant owner approval.
3. Configure secrets only in the approved secret layer.
4. Attach sandbox evidence.
5. Verify secret redaction in browser responses, logs, audit metadata, Student PWA models, and communication templates.
6. Confirm rollback steps and owners.
7. Record production approval.

For LMS activation, use:

- `docs/releases/2026-06-26-full-lms-integration-readiness.md`
- `docs/runbooks/lms-execution-workers.md`
- `docs/integrations/moodle-provider-configuration.md`
- `docs/integrations/canvas-provider-configuration.md`

Local LMS implementation evidence commands:

```bash
node --import tsx --test src/modules/lms-contract/__tests__/moodle-*.test.ts src/modules/student-pwa/__tests__/lms-launch-orchestration.test.ts
node --import tsx --test src/modules/lms-contract/__tests__/canvas-*.test.ts src/modules/student-pwa/__tests__/lms-launch-orchestration.test.ts
```

These commands prove local contract behavior. They do not replace real provider sandbox evidence.

## 7. Run The Role Walkthrough

Generate the role walkthrough package:

```bash
npm run verify:role-walkthrough
```

Then follow:

- `docs/acceptance/role-matrix-checklist.md`
- `docs/acceptance/authenticated-role-walkthrough-evidence.md`

For each pilot tenant, capture screenshots and console-error output for the supported admin, registrar, faculty, student, guardian, finance, admissions, and platform-admin paths.

## 8. Handle Sensitive Data

Never commit:

- `.env` or populated `.env.local` files;
- Supabase service role keys;
- database URLs;
- payment secrets;
- email/SMS provider API keys;
- Moodle or Canvas tokens;
- webhook signatures;
- raw provider payloads;
- real student, guardian, financial, counseling, transcript, or aid records.

Provider secrets must never appear in:

- browser responses;
- Student PWA or guardian read models;
- audit metadata;
- official records;
- ShepherdAI or LLIS payloads;
- reporting exports;
- logs;
- ordinary Academy domain tables.

## 9. Troubleshoot Common Issues

### The app opens on the wrong port

The app runs on port `3200`:

```bash
npm run dev
```

Open `http://localhost:3200`.

### Protected pages redirect to login

Check:

- Supabase local services are running.
- `.env.local` points to the local Supabase URL and keys.
- The seeded user has an Academy account link and active role assignment.
- The route is not being accessed with only spoofed headers.

### Migrations fail on re-run

Use the repo migration runner:

```bash
npm run db:migrate:local
```

It tracks applied migrations through `public.schema_migrations`. If an older local database predates the tracker, run the migration-seed rehearsal verifier and inspect the reported object markers before editing migrations.

### Lint exits with warnings

Warnings are currently tolerated by the command, but new changes should not add more. If a changed file emits a warning, fix it in the same change.

### Provider activation appears unavailable

That is expected unless sandbox evidence, tenant approval, validation evidence, and required secret references are present. Check `/admin/settings/lms` and the provider activation runbook before changing provider state.

## 10. Release Checklist

Before a release or merge:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Then confirm:

- README, HOWTO, CHANGELOG, VERSIONING, release notes, and project status are current.
- New behavior has tests.
- Migrations and RLS policies are verified.
- Provider activation gates are not overstated.
- General availability is not claimed unless approved by the governing review.
