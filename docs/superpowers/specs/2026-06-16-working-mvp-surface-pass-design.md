# Working MVP Surface Pass Design

## Purpose

This slice makes the existing MVP screens easier to use by replacing redirect-only index routes and adding dashboard navigation to already-working surfaces. It does not add new operational transactions.

## Scope

Included:

- `/students` authenticated index page.
- `/programs` authenticated index page.
- `/` dashboard quick-action navigation to important working routes.
- Tests that protect the index pages from returning to redirect-only behavior.
- Documentation/status update.

Excluded:

- New admissions workflow states.
- Registration, attendance, billing, transcript issuance, payments, or financial aid implementation.
- New database migrations.
- New AI autonomy or ShepherdAI decision-making.

## Architecture

The implementation follows existing App Router server component patterns. Index pages call `loadProtectedAcademyDataset`, map tenant-scoped records into cards/tables, and link to existing detail screens. The dashboard remains the root operational hub and adds a small action grid below existing metrics.

## Data Flow

1. Supabase session resolves to an Academy actor.
2. `loadProtectedAcademyDataset` loads the actor tenant dataset under verified database context.
3. Pages render derived counts, statuses, and links.
4. Detail routes keep their existing loaders and behavior.

## Security And Privacy

Student and program indexes are staff/admin surfaces. The pages must not import seeded mock data directly and must not trust request headers. Student records shown are the existing protected dataset records for the actor tenant. ShepherdAI remains human-reviewed and staff-facing.

## Testing

Tests should read page source to ensure the index routes no longer import `redirect` from `next/navigation` and should verify the pages use `loadProtectedAcademyDataset`. Dashboard tests should confirm the new quick-action labels and route hrefs are present.

## Acceptance Criteria

- `/students` displays student records and links to `/students/[id]`.
- `/programs` displays program records and links to `/programs/[id]`.
- `/` dashboard exposes the target MVP routes as direct actions.
- Lint, tests, and build pass.
