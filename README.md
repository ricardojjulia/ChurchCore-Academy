# ChurchCore Academy

This repository is the codebase for **ChurchCore Academy**, a faith-based education management system and student information system for Bible schools, children's schools, seminaries, colleges, and universities.

ChurchCore Academy is designed to help faith-based institutions manage students, academic years, terms, divisions, programs, courses, grading, faculty, institutional records, transcripts, academic workflows, and student-facing services through a configurable Academy core and student PWA.

## Boundary

- This repo is **not** a Moodle fork.
- This repo owns the faith-based SIS, education-management workflows, enrollment, academic years, terms, course catalog, grading models, student records, transcripts, faculty/teacher workflows, graduation tracking, compliance review, and institutional academic operations.
- The LMS must live outside this repository and integrate through provider adapters.
- Integration between the two systems should happen through explicit contracts such as SSO, roster sync, enrollment sync, grade/progress exchange, and launch/logout flows.
- ChurchCore Academy is **not** the LMS.

## Institution types

ChurchCore Academy should support multiple faith-based education models with the same core architecture:

- Bible schools and ministry training institutes
- children's schools and K-12-style programs
- certificate programs and academies
- seminaries and theological schools
- colleges and universities

Each institution should be able to configure its own academic calendar, sub-divisions, course durations, grading model, faculty/teacher roles, student lifecycle, and LMS provider.

## ShepherdAI Academy

This repository now includes the first foundation for **ShepherdAI for ChurchCore Academy**.

ShepherdAI Academy is:

- an explainable Academic Workflow recommendation engine
- deterministic first
- product-specific to ChurchCore Academy
- human-reviewed and audit-friendly

ShepherdAI Academy is not:

- a chatbot
- a conversational AI assistant
- a cross-product intelligence layer
- a source of final graduation or standing decisions without deterministic institutional rules

## Stack

- `Next.js` App Router
- `React`
- `TypeScript`
- `Tailwind CSS`
- `Supabase` for database, auth, and storage
- `Vercel` for deployment

## Current Academy scope

- institution configuration
- academic year, term, session, cohort, and sub-division setup
- student, guardian, faculty, teacher, professor, and administrator records
- course catalog, course types, course durations, and section setup
- grading scales, grading types, GPA rules, pass/fail rules, narrative evaluation, and transcript rules
- incomplete enrollment follow-up
- missing student documentation review
- graduation eligibility review
- academic standing or credit progress review
- transcript or records inconsistency review
- faculty or course assignment imbalance review
- student PWA for schedule, grades, documents, registration, progress, messages, and LMS launch
- optional LMS provider integration through Moodle, Canvas, or no-LMS mode

## Production MVP status

Release 1 security foundations are implemented on the active security branch:

- Academy APIs derive identity from verified Supabase sessions.
- Tenant, Academy person, and active roles come from persisted account links and role assignments.
- Caller-supplied Academy headers cannot grant production authority.
- Academy tables have an append-only migration that enables and forces RLS with tenant, staff, student, and guardian policy families.
- Protected dashboard and record pages load authenticated tenant data and fail closed instead of serving seeded records.
- Student PWA routes require a verified student role and show empty states until persistent Release 2 read models are connected.
- Immutable audit storage and a redacted audit repository are implemented.

Release 1 is not yet production-approved. Remaining blockers include end-to-end RLS claim testing, browser role verification, the historical local migration-runner incompatibility, and a supported Node runtime. Releases 2–5 in the production MVP remediation spec remain planned.

## Local development

1. Copy `.env.example` to `.env.local`
2. Set:
   `NEXT_PUBLIC_SUPABASE_URL`
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   `SUPABASE_SERVICE_ROLE_KEY`
   `DEMO_MODE_ENABLED`
   `NEXT_PUBLIC_DEMO_MODE_ENABLED`
   `NEXT_PUBLIC_DEMO_VERSION`
   `DATABASE_URL`
   `ACADEMY_LOCAL_BOOTSTRAP_ENABLED` (local loopback development only)
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`

Protected Academy pages and APIs fail closed without Supabase and database configuration. Seeded records are available only through tests, seed commands, or explicit non-production demo mode.

## Demo feedback and triage

ChurchCore Academy now includes a demo-only feedback and error-triage pipeline.

- Enable demo mode with both:
   - `DEMO_MODE_ENABLED=true` (server gate)
   - `NEXT_PUBLIC_DEMO_MODE_ENABLED=true` (client gate)
- Optional demo label:
   - `NEXT_PUBLIC_DEMO_VERSION=2026.06.11`

When enabled, demo users can submit feedback from the global floating button and unhandled React render errors are captured through a global error boundary.

Platform staff triage workspace:

- route: `/settings/demo-feedback`
- API list: `GET /api/academy/platform/demo-feedback`
- API mutate: `PATCH /api/academy/platform/demo-feedback/:id`

Submission API:

- `POST /api/academy/demo-feedback`

Browser-generated session IDs can be rotated by the browser session lifecycle. Per-session throttling helps reduce accidental floods but is not complete bot protection.

## Next delivery gates

1. Complete Release 1 request-scoped repository conversion and live RLS/browser verification.
2. Build Release 2 admissions, registration, attendance, grade entry, transcript issuance, and persistent Student PWA workflows.
3. Build Release 3 billing, Stripe payments, institutional aid, and student account workflows.
4. Build regulated federal-aid capabilities only behind sandbox certification and production activation gates.
5. Execute Moodle and Canvas operations through audited outbox workers in Release 5.

## Suggested layout

- `apps/` for deployable applications
- `packages/` for shared libraries
- `docs/` for architecture and integration notes

See [docs/architecture.md](docs/architecture.md) and [docs/shepherd-ai-academy.md](docs/shepherd-ai-academy.md).

## Planning docs

- [Faith-Based Academy Master Plan](docs/product/faith-based-academy-master-plan.md)
- [Factory Roadmap](docs/product/factory-roadmap.md)
- [Software Factory](docs/software-factory.md) for Codex, GitHub Copilot, Claude Code, and similar AI coding tools
- [Production MVP Remediation Design](docs/superpowers/specs/2026-06-13-production-mvp-remediation-design.md)
- [Release 1 Security Plan](docs/superpowers/plans/2026-06-13-release-1-production-security-foundation.md)
- [Academy Auth And Tenant Runbook](docs/runbooks/academy-auth-and-tenant-access.md)
- [Platform Design Spec](docs/superpowers/specs/2026-06-01-faith-based-academy-platform-design.md)
- [Institution Type And Operating Rules Design](docs/superpowers/specs/2026-06-01-institution-type-operating-rules-design.md)
- [Implementation Master Plan](docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md)
- [Dual LMS Provider Strategy](docs/lms-dual-provider-strategy.md)
- [ADR Procedure](docs/adr/README.md)
- [Reviewer Procedure](docs/reviews/reviewer-procedure.md)
- [Product Opportunity Scout](docs/agents/product-opportunity-scout.md)
