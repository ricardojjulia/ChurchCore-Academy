# Contributing to ChurchCore Academy

Thank you for helping improve ChurchCore Academy. This project handles sensitive education records, identity, permissions, and academic workflows, so contributions must preserve the product and security boundaries documented in the repository.

## Before You Start

1. Read the [README](README.md), [architecture boundary](docs/architecture.md), and [software factory](docs/software-factory.md).
2. Search existing issues and pull requests.
3. Open an issue before substantial product, schema, security, or architecture work.
4. Keep changes focused on one reviewable outcome.

## Development Setup

```bash
npm install
cp .env.example .env.local
supabase start
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Use Node.js 24 or newer.

## Engineering Rules

- Academy is the academic system of record; Moodle and Canvas remain external providers.
- Every persistent domain record must be tenant-scoped.
- Production identity comes from a verified Supabase session and persisted Academy identity records.
- Do not authorize from caller-supplied headers or editable JWT metadata.
- Student, guardian, faculty, advisor, and administrator access must be explicitly tested.
- Migrations that add tables must define constraints, indexes, grants, and RLS behavior.
- Audit and evidence records must be append-only when their integrity matters.
- ShepherdAI and LLIS behavior must remain explainable, consent-aware, and human-reviewed.
- Do not mix unrelated refactors into feature work.

## Factory Workflow

Substantial changes follow the repository software factory:

1. discovery
2. design specification
3. implementation plan
4. test-driven execution
5. verification
6. review
7. delivery

Designs belong in `docs/superpowers/specs/`; implementation plans belong in `docs/superpowers/plans/`. Architecture decisions belong in `docs/adr/`.

## Verification

Run the complete baseline:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Run the relevant live database verifier for changes to protected workflows:

```bash
npm run verify:admissions-rls
npm run verify:enrollment-conversion-rls
npm run verify:llis-consent-rls
```

UI changes also require browser verification at desktop and narrow viewport sizes. Migration changes require a clean local migration replay and Supabase database lint.

## Pull Requests

Pull requests should include:

- the problem and approved scope
- the implementation approach
- security, privacy, and tenant-isolation impact
- migrations and operational impact
- exact verification commands and results
- screenshots for visible UI changes
- remaining limitations or follow-up work

Keep commits intentional and messages concise. Do not include secrets, populated environment files, generated local databases, or unrelated workspace changes.

## Reporting Security Issues

Do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](SECURITY.md).

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
