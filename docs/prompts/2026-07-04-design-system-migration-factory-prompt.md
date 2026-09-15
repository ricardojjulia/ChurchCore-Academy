# Factory Prompt: Academy Design System Migration

Date: 2026-07-04
System: ChurchCore Academy
Repository: `/Users/rjulia/ChurchCore Academy`
Phase: Council Review XIV - Design System Migration

---

## What You Are Building

You are executing the approved Academy design-system migration foundation. A complete SIS design-system package was reviewed and approved as source material, but the council explicitly rejected importing it as `styled-components`, plain HTML/CSS snippets, or a separate internal npm package.

You will convert the package into ChurchCore Academy's existing Tailwind/Radix/Lucide UI system by normalizing tokens, updating shared primitives, converging shells, migrating one admin route group, verifying accessibility, and documenting the release foundation.

---

## Read First

Read all of these before editing:

- `CLAUDE.md`
- `docs/software-factory.md`
- `docs/technology.md`
- `docs/reviews/2026-07-04-council-review-14-design-system-migration.md`
- `docs/adr/0068-tailwind-radix-design-system-migration.md`
- `docs/superpowers/specs/2026-07-04-design-system-migration-design.md`
- `docs/superpowers/plans/2026-07-04-design-system-migration.md`
- `docs/prompts/2026-07-04-design-system-migration-ai-prompts.md`
- attached source package if available: `/Users/rjulia/.codex/attachments/ae17e9ee-598c-47c9-a330-63e155b272a6/pasted-text.txt`

Reference files:

- `tailwind.config.ts`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/styles/tokens.css`
- `src/styles/shared.css`
- `src/styles/admin.css`
- `src/styles/student-pwa.css`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/toast-viewport.tsx`
- `src/components/admin-shell.tsx`
- `src/components/faculty-shell.tsx`
- `src/components/academy-shell.tsx`

---

## Non-Negotiable Rules

1. Do not add `styled-components`.
2. Do not create a separate UI package.
3. Do not copy the package's plain HTML/CSS snippets into the app.
4. Keep `src/components/ui/*` as the primitive layer.
5. Preserve existing exports from primitives unless every consumer is updated.
6. Preserve business logic, authorization, session handling, RLS behavior, data loading, API behavior, and server actions.
7. Do not expose additional sensitive data.
8. Keep legacy token aliases until dependent CSS has migrated.
9. Migrate one admin route group first, not the full app.
10. Run verification before claiming completion.

---

## Execution Order

### Phase 1 - Token Bridge

Execute Task 1 from `docs/superpowers/plans/2026-07-04-design-system-migration.md`.

Expected result:

- normalized `--sis-*` tokens exist in `src/styles/tokens.css`
- Tailwind semantic values point to token-backed values where practical
- base focus/body styling remains coherent
- legacy aliases remain intact

Commit:

```bash
git commit -m "feat(ui): add academy design token bridge"
```

### Phase 2 - Shared Primitives

Execute Task 2 from the plan.

Expected result:

- button, card, table, badge, tabs, and toast behavior align with the token bridge
- no primitive export breakage
- tabs and toasts meet the accessibility requirements if touched

Commit:

```bash
git commit -m "feat(ui): align shared primitives with academy design system"
```

### Phase 3 - Shell Convergence

Execute Task 3 from the plan.

Expected result:

- AdminShell, FacultyShell, and AcademyShell use the token path more consistently
- navigation behavior, search behavior, mobile behavior, and sign-out forms remain unchanged
- no protected-route behavior changes

Commit:

```bash
git commit -m "feat(ui): converge academy shells on design tokens"
```

### Phase 4 - First Admin Route Group

Execute Task 4 from the plan.

Pick exactly one of:

- `/admin/settings/institution`
- `/admin/settings/calendar`
- `/admin/people`

Expected result:

- selected route group uses migrated primitives and tokens
- no business logic changes
- no new hard-coded color sprawl
- browser smoke passes at desktop and mobile widths

Commit:

```bash
git commit -m "feat(ui): migrate first admin route group"
```

### Phase 5 - Documentation And Release Closeout

Execute Task 5 from the plan.

Expected result:

- `docs/releases/2026-07-04-design-system-foundation.md` exists
- `docs/technology.md` describes the token/primitive path
- any roadmap update is accurate and does not imply full-app migration is complete

Commit:

```bash
git commit -m "docs(ui): record design system migration foundation"
```

---

## Verification Gate

Run after implementation:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Also run browser smoke checks for:

- `http://localhost:3200/login`
- selected migrated admin route group, with authentication if local seeded credentials are available
- mobile width around 390px
- desktop width around 1440px

Check:

- no blank page
- no overlapping text
- visible focus states
- dialogs and menus operate
- table headers remain readable
- buttons fit text
- no sensitive records are newly exposed

---

## Final Report

When complete, report:

- route group selected
- changed files
- verification commands and results
- browser smoke result
- remaining unmigrated route groups
- any pre-existing warnings or residual risk

Do not claim the whole product has been redesigned. Claim only the design-system foundation and the selected route-group migration.
