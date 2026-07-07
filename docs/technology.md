# Technology Overview

## Application Runtime

ChurchCore Academy is a TypeScript application built with Next.js App Router and React. Server Components provide protected page composition; route handlers expose Academy APIs. The interface uses repository-owned Tailwind CSS primitives, Radix UI foundations, and Lucide icons for product-specific presentation. ADR-0068 establishes `src/styles/tokens.css` as the normalized design-token bridge for Tailwind semantics and shared UI primitives; new UI work should extend the token and `src/components/ui/*` primitive path instead of adding a parallel styling library.

## Data and Identity

Supabase provides external authentication and local development services. Academy authorization does not trust editable user metadata. A verified Supabase subject resolves through persisted account links and active Academy role assignments.

PostgreSQL is the system of record. Application requests use `pg` transactions that set tenant and person context before repositories execute. Row Level Security is enabled and forced on protected Academy tables.

## Domain Architecture

Business behavior lives in focused modules under `src/modules/`:

- institution configuration and academic calendars
- course catalog and grading records
- people, guardians, faculty, and permissions
- admissions and enrollment conversion
- Student PWA read models and LMS launch
- academic workflows and ShepherdAI Academy
- learner intelligence, consent, and interventions
- audit and scheduled-job boundaries

API handlers adapt HTTP requests to domain services. Repositories own SQL mapping. Policies authorize actors before data access, while RLS provides the database backstop.

## Security Model

- Supabase `auth.getUser()` verifies sessions.
- Academy identity comes from database account links and role assignments.
- Request-scoped PostgreSQL settings drive RLS.
- Composite foreign keys prevent cross-tenant references.
- Sensitive histories use append-only triggers.
- Mutations use idempotency keys where retries can duplicate business actions.
- Service-role credentials remain server-only.

## LMS Integration

The LMS contract is provider-neutral. Moodle, Canvas, and no-LMS implementations expose capabilities without moving Academy business rules into provider code. Provider returns create reviewed imports; they do not directly post official grades or transcripts.

## AI and Learner Intelligence

ShepherdAI Academy is deterministic first and generates reviewable academic workflow suggestions from Academy-owned records. It is not a general chatbot or an autonomous decision maker.

The Living Learner Intelligence System is separately governed. Protected processing requires explicit learner consent, tenant RLS, immutable evidence, expiry, and human review. Model-generated predictions and autonomous interventions remain blocked pending Council approval.

## Verification

The standard quality gate is:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Protected database workflows also use live role-matrix scripts and Supabase schema lint. UI changes require browser acceptance.

## Deployment Model

The application targets a Vercel-compatible Next.js deployment with Supabase for authentication and PostgreSQL. External LMS providers remain independently operated services connected through audited Academy contracts.
