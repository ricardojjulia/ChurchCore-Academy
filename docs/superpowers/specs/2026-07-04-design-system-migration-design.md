# Design Specification: Academy Design System Migration

Date: 2026-07-04
ADR: 0068
Council Review: XIV
Source package: `/Users/rjulia/.codex/attachments/ae17e9ee-598c-47c9-a330-63e155b272a6/pasted-text.txt`

---

## Overview

This specification converts the attached SIS design-system package into a ChurchCore Academy implementation plan. The package is feasible and directionally useful, but it must not be imported as a separate `styled-components` component library. ChurchCore Academy already uses Next.js App Router, React, Tailwind, Radix foundations, Lucide icons, and repository-owned UI primitives. The migration therefore adopts the package as a token, accessibility, and component-behavior source, then implements it through the existing Tailwind/Radix stack.

The goal is a coherent, competitive, accessible SIS interface without creating a parallel styling architecture.

---

## Current State

The app already has several UI layers:

- global Tailwind setup in `tailwind.config.ts`
- root CSS import order in `src/app/layout.tsx`
- token aliases in `src/styles/tokens.css`
- shared utility CSS in `src/styles/shared.css`
- large product CSS files in `src/styles/admin.css` and `src/styles/student-pwa.css`
- reusable primitives under `src/components/ui/`
- Academy-specific helpers under `src/components/academy/`
- shell components in `src/components/admin-shell.tsx`, `src/components/faculty-shell.tsx`, and `src/components/academy-shell.tsx`

This works, but the design language is split across Tailwind tokens, CSS custom properties, hard-coded hex values, shell-specific classes, and duplicate card/table/button concepts.

---

## Migration Decision

Use the attached package as an input, not as a dependency.

Accepted:

- token vocabulary for primary, secondary, warning, error, surfaces, text, spacing, radii, and shadows
- WCAG AA checklist and ARIA patterns
- component inventory: app shell, navigation, buttons, cards, tables, forms, toasts, alerts
- dark-mode concept, but only as a deferred implementation unless the page already supports it

Rejected:

- adding `styled-components`
- publishing an internal npm package for this repo
- copying the plain HTML/CSS snippets into the app
- introducing a new AppBar/NavDrawer stack that bypasses `AdminShell` or existing route shells

---

## Target Architecture

### 1. Token Source

`src/styles/tokens.css` becomes the durable CSS-token source for Academy product tokens. It keeps backward-compatible aliases while adding normalized SIS tokens:

- `--sis-primary`
- `--sis-primary-dark`
- `--sis-secondary`
- `--sis-warning`
- `--sis-error`
- `--sis-bg-canvas`
- `--sis-surface`
- `--sis-border`
- `--sis-text-primary`
- `--sis-text-secondary`
- `--sis-radius-sm`
- `--sis-radius-md`
- `--sis-shadow-elev`

`tailwind.config.ts` maps Tailwind semantic colors to these CSS variables instead of duplicating fixed color values.

### 2. Primitive Layer

`src/components/ui/` remains the canonical primitive layer. The migration updates existing primitives rather than adding new sibling libraries:

- `button.tsx`
- `card.tsx`
- `table.tsx`
- `badge.tsx`
- `input.tsx`
- `textarea.tsx`
- `select.tsx`
- `toast-viewport.tsx`
- `tabs.tsx`
- `dialog.tsx`

The primitive layer owns reusable interaction and accessibility behavior. Product pages may pass class names, but they should not recreate primitive styles from scratch.

### 3. Product Shell Layer

`AdminShell`, `FacultyShell`, and `AcademyShell` remain product shells. The migration should converge their visual language using tokens and shared class names instead of replacing routing or authorization behavior.

The admin shell is the first migration target because most competitive SIS workflows live there.

### 4. Page Migration Layer

Pages migrate by route group, not by one repo-wide visual patch:

1. Admin shell and global primitives
2. Admin settings pages
3. People, students, programs, and admissions pages
4. Faculty gradebook and faculty workflow pages
5. Student PWA pages
6. Guardian pages
7. Platform control and demo-feedback surfaces

Each route group must keep its data model and authorization unchanged.

---

## Visual Rules

- Use compact, work-focused layouts for operational SIS screens.
- Keep cards at `8px` radius where the design package calls for system cards; avoid inflating every panel into large decorative cards.
- Use Lucide icons for commands and navigation.
- Prefer icon buttons for obvious tool actions and text buttons for explicit commands.
- Do not add marketing-style hero sections to app surfaces.
- Do not add gradient orb, bokeh, or decorative blob backgrounds.
- Tables must remain dense, readable, keyboard reachable, and responsive.
- Form labels, errors, and helper text must be explicit and associated with inputs.
- Button text must fit without overlap on mobile and desktop.

---

## Accessibility Requirements

The migration must enforce:

- visible `:focus-visible` rings for links, buttons, inputs, selects, textareas, tabs, menu items, and dialog controls
- `th scope="col"` or equivalent semantic table header support
- `aria-expanded` on collapsible navigation controls
- dialog title/description wiring through existing Radix patterns
- toasts with `role="status"` and `aria-live="polite"` for non-critical updates
- destructive confirmations through existing alert-dialog patterns
- no color-only state communication
- keyboard navigation for nav, tabs, menus, dialogs, and table actions

Existing gaps found by council reviews, especially tabs ARIA wiring, should be corrected during the primitive pass.

---

## Scope

### In Scope

- Design-token normalization
- Tailwind semantic color/radius/shadow mapping
- Updating existing UI primitives
- Converging shell styling
- Migrating high-value admin workflows first
- Accessibility acceptance tests where feasible
- Browser smoke checks for migrated surfaces
- Documentation and release notes

### Out Of Scope

- Replacing Next.js App Router
- Adding `styled-components`
- Adding a separate package workspace
- Changing business logic, database schema, RLS, or authorization
- Implementing a new dark-mode switch in this slice
- Redesigning domain workflows beyond component and layout consistency

---

## Acceptance Criteria

The migration is accepted when:

1. `src/styles/tokens.css` and `tailwind.config.ts` expose one coherent token bridge.
2. Existing primitives use the token bridge and remain API-compatible unless the plan names a deliberate small breaking change.
3. `AdminShell` and at least the first admin route group render with the migrated system.
4. Hard-coded colors and duplicate CSS in migrated files are reduced, not expanded.
5. Accessibility checks cover focus states, nav disclosure, dialogs, tabs, tables, forms, and toasts.
6. `npm test`, `npm run lint`, and `npm run build` pass or documented pre-existing warnings remain warnings only.
7. A browser smoke check verifies migrated pages at desktop and mobile widths.
8. Docs point future work to the token/primitive path rather than styled-components or plain HTML/CSS snippets.

---

## Rollback

The first execution slice must be easy to roll back:

- Keep old CSS aliases in `tokens.css` until all dependent CSS is migrated.
- Avoid deleting large shell CSS blocks in the first pass.
- Update primitives in small commits with route-level browser verification.
- If a migrated surface regresses, revert that route group without reverting token aliases.

---

## Open Risks

- `admin.css` and `student-pwa.css` are large enough that broad edits can create visual regressions.
- The attached package uses lower radii than some current Academy components; the migration should standardize by component type, not blindly lower all radius values.
- Some existing docs still mention older UI assumptions. Prompted execution must update docs when implementation changes durable UI conventions.
- Accessibility failures may already exist before the migration; the execution prompt must separate pre-existing issues from migration regressions.
