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

## Local development

1. Copy `.env.example` to `.env.local`
2. Set:
   `NEXT_PUBLIC_SUPABASE_URL`
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   `SUPABASE_SERVICE_ROLE_KEY`
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`

The app will boot without Supabase credentials, but Supabase-backed features should only be added after the env vars are configured.

## Next steps

1. Implement the faith-based institution configuration model.
2. Add academic year, term, subdivision, course, grading, and transcript configuration.
3. Add authenticated Academy roles and protected routes for institutions, staff, faculty, students, and guardians.
4. Replace mock Academy records with Supabase-backed repositories for the full Academy data model.
5. Add the student PWA shell and student-facing workflows.
6. Define a provider-neutral LMS contract and implement Moodle first, Canvas second, and no-LMS mode as a valid tenant configuration.
7. Keep ShepherdAI Academy constrained to explainable, human-reviewed academic workflow recommendations from Academy-owned data.

## Suggested layout

- `apps/` for deployable applications
- `packages/` for shared libraries
- `docs/` for architecture and integration notes

See [docs/architecture.md](docs/architecture.md) and [docs/shepherd-ai-academy.md](docs/shepherd-ai-academy.md).

## Planning docs

- [Faith-Based Academy Master Plan](docs/product/faith-based-academy-master-plan.md)
- [Factory Roadmap](docs/product/factory-roadmap.md)
- [Software Factory](docs/software-factory.md) for Codex, GitHub Copilot, Claude Code, and similar AI coding tools
- [Platform Design Spec](docs/superpowers/specs/2026-06-01-faith-based-academy-platform-design.md)
- [Institution Type And Operating Rules Design](docs/superpowers/specs/2026-06-01-institution-type-operating-rules-design.md)
- [Implementation Master Plan](docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md)
- [Dual LMS Provider Strategy](docs/lms-dual-provider-strategy.md)
- [ADR Procedure](docs/adr/README.md)
- [Reviewer Procedure](docs/reviews/reviewer-procedure.md)
- [Product Opportunity Scout](docs/agents/product-opportunity-scout.md)
