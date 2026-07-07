# ChurchCore Academy - Design System Foundation

**Release date:** 2026-07-04
**Stage:** design-system foundation
**Governing decision:** ADR-0068

---

## What This Release Delivers

This slice implements the first approved Tailwind/Radix design-system migration foundation. It does not redesign the whole application. It establishes the token bridge, updates shared primitives, converges the product shells toward the same token source, and migrates the first admin route group: `/admin/settings/institution`.

---

## Token Bridge

`src/styles/tokens.css` now exposes normalized `--sis-*` design tokens for primary color, secondary color, warning/error states, canvas and surface colors, text colors, borders, radii, and elevation.

`tailwind.config.ts` maps semantic Tailwind colors to that token layer while keeping opacity modifiers available through HSL channel tokens. Legacy aliases remain in place so older admin and student PWA CSS can be migrated safely over time.

---

## Shared Primitives

The shared primitive layer remains `src/components/ui/*`. This slice aligns the core primitives with the token bridge:

- `Button`
- `Card`
- `Table`
- `Badge`
- `ToastViewport`
- existing `Tabs` accessibility wiring verified by contract test

The migration did not add `styled-components`, did not create a separate UI package, and did not copy plain HTML/CSS snippets from the source design package.

---

## Shell Convergence

`AdminShell`, `FacultyShell`, and `AcademyShell` keep their current navigation, route, search, mobile sidebar, and sign-out behavior. Their shared CSS now uses token-backed colors and surface rules more consistently.

`AcademyShell` no longer carries inline sign-out button styles; styling is owned by the CSS layer.

---

## First Route Group Migrated

The first route group migrated is:

```text
/admin/settings/institution
```

This route already represented institution configuration and mode-pack review, so it was the safest first visual migration target. The work keeps server data loading, fetch behavior, dialogs, and authorization unchanged. It removes inline icon sizing and tokenizes the metric/review tile styling used by the route.

---

## Verification

Required verification for this slice:

```bash
node --import tsx --test src/components/ui/design-system-contract.test.ts
npm test
npm run lint
npm run build
git diff --check
```

UI verification should also include browser smoke checks for:

- `/login`
- `/admin/settings/institution`
- desktop width around 1440px
- mobile width around 390px

---

## Remaining Route Groups

The following route groups are not fully migrated by this slice:

- `/admin/settings/calendar`
- `/admin/people`
- `/admin/students`
- `/admin/programs`
- `/admin/courses`
- faculty routes
- student PWA routes
- guardian routes
- platform control and demo-feedback surfaces

Future visual work should migrate these route groups incrementally through ADR-0068 rather than introducing a second design system.
