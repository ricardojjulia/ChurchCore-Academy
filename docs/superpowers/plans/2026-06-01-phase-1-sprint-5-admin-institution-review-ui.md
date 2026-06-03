# Phase 1 Sprint 5: Admin Review UI For Institution Configuration

## Factory Intake

- Product area: ChurchCore Academy institution configuration.
- Sprint length: 1 week.
- Reviewable outcome: a read-only admin UI entry point for reviewing tenant institution configuration.
- Institution modes affected: Bible school, children's school, seminary, college, university, and mixed.
- Boundary: review-only UI. Editing, approvals, audit trails, and role-scoped mutation endpoints remain future work.

## Discovery Notes

- Institution configuration types, defaults, validation, migration, seed data, repository, and API read path already exist.
- The app shell provides the main academic admin navigation and can host an Institution settings entry.
- The current API read path is available, but the UI can safely render the seeded Academy profile without requiring a database during static builds.
- Tenant isolation exists at the repository/API read boundary; full admin authorization has not been implemented yet.

## Chosen Design Approach

- Add a pure institution review view model that converts domain configuration into stable admin-facing labels.
- Render a server page at `/settings/institution` using the existing Academy shell, cards, badges, and operational review styling.
- Keep the page read-only to preserve the security boundary until institution-admin permissions and write endpoints exist.
- Surface validator warnings in the UI so configuration problems can be reviewed before downstream calendar, grading, LMS, and PWA work depends on them.

## Files

- `src/modules/academy-config/review-view.ts`: review model builder for identity, operating rules, capabilities, LMS preference, and validation warnings.
- `src/modules/academy-config/__tests__/institution-config-review-view.test.ts`: tests for readable labels and validation warning exposure.
- `src/app/settings/institution/page.tsx`: admin review page.
- `src/components/academy-shell.tsx`: Institution navigation entry and active-link support.
- `src/app/globals.css`: responsive layout helpers for institution review tiles.
- `docs/product/factory-roadmap.md`: Sprint 5 status.
- `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`: Subplan 2 status.

## Test Plan

- `npm test -- src/modules/academy-config/__tests__/institution-config-review-view.test.ts`
- `npm test`
- `npm run lint`
- `npm run build`
- Start `npm run dev` and verify `/settings/institution` renders.

## Security And Privacy Review

- No write endpoints are introduced.
- No student records, grades, guardians, or transcript details are exposed by this page.
- The page uses current seeded tenant data only; production tenant enforcement must be handled before editable administration ships.
- LMS state is displayed as a provider preference, not as runtime provider credentials or sync data.

## Delivery Checklist

- [x] Create failing review-model test.
- [x] Implement review model.
- [x] Add admin Institution navigation entry.
- [x] Add `/settings/institution` read-only review page.
- [x] Update sprint and master-plan docs.
- [x] Run full verification.
- [x] Browser-check the new route.
