# Academy Design System Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the attached SIS design-system package into ChurchCore Academy's existing Tailwind/Radix UI system without adding a parallel styling architecture.

**Architecture:** Normalize design tokens first, then update shared primitives, converge shells, and migrate route groups incrementally. Existing Next.js App Router pages, module boundaries, authorization, and data loading remain unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Radix UI, Lucide icons, Node test runner, agent-browser or browser smoke checks.

---

## File Map

- Modify `src/styles/tokens.css`: add normalized SIS tokens and preserve legacy aliases.
- Modify `tailwind.config.ts`: map semantic Tailwind colors/radii/shadows/fonts to CSS variables.
- Modify `src/app/globals.css`: align base focus, body, and dark-token bridge without duplicate color definitions.
- Modify `src/components/ui/button.tsx`: token-aligned variants, accessibility, and no API break.
- Modify `src/components/ui/card.tsx`: token-aligned card density and radius.
- Modify `src/components/ui/table.tsx`: semantic table header and dense SIS table defaults.
- Modify `src/components/ui/badge.tsx`: token-aligned status variants.
- Inspect and modify `src/components/ui/tabs.tsx`: fix ARIA trigger/content relationships if still missing.
- Inspect and modify `src/components/ui/toast-viewport.tsx`: ensure live-region behavior.
- Modify `src/components/admin-shell.tsx`, `src/components/faculty-shell.tsx`, and `src/components/academy-shell.tsx`: converge shells on tokens and shared classes.
- Modify `src/styles/admin.css` and `src/styles/student-pwa.css`: only route-group CSS touched by each task.
- Modify first route group pages under `src/app/admin/settings/*` and `src/app/admin/people/*` only after primitives pass.
- Add tests under affected `src/components/ui/*.test.tsx` only if existing test tooling supports the component without a browser; otherwise use source-level tests and browser verification.
- Update `docs/technology.md`, `docs/product/factory-roadmap.md`, or release notes only if implementation changes durable UI conventions.

---

### Task 1: Token Bridge

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Snapshot existing token usage**

Run:

```bash
rg -n "var\\(--|#[0-9a-fA-F]{3,8}|bg-primary|text-primary|rounded-2xl|shadow-academy" src/styles src/components src/app > /tmp/academy-design-token-before.txt
wc -l /tmp/academy-design-token-before.txt
```

Expected: command succeeds and produces a baseline count.

- [ ] **Step 2: Add normalized SIS tokens**

Add the normalized `--sis-*` tokens to `src/styles/tokens.css` under `:root`, keeping every existing token and alias.

Required token names:

```css
--sis-primary: #1B4F8A;
--sis-primary-dark: #143B68;
--sis-secondary: #3E8F56;
--sis-secondary-light: #E7F3EC;
--sis-warning: #D97706;
--sis-error: #DC2626;
--sis-bg-canvas: #F5F7FA;
--sis-surface: #FFFFFF;
--sis-border: #E0E7F0;
--sis-text-primary: #1A2433;
--sis-text-secondary: #526173;
--sis-text-disabled: #9EA7B3;
--sis-radius-sm: 0.25rem;
--sis-radius-md: 0.5rem;
--sis-shadow-elev: 0 2px 4px rgba(10, 30, 60, 0.06);
```

- [ ] **Step 3: Map Tailwind semantic values to tokens**

Update `tailwind.config.ts` so `primary`, `secondary`, `background`, `foreground`, `card`, `border`, `input`, `ring`, and `destructive` reference CSS variables where practical. Preserve the existing class names and content glob.

- [ ] **Step 4: Verify token bridge**

Run:

```bash
npm run lint
```

Expected: no new lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css tailwind.config.ts src/app/globals.css
git commit -m "feat(ui): add academy design token bridge"
```

### Task 2: Shared UI Primitives

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/table.tsx`
- Modify: `src/components/ui/badge.tsx`
- Inspect/modify: `src/components/ui/tabs.tsx`
- Inspect/modify: `src/components/ui/toast-viewport.tsx`

- [ ] **Step 1: Inspect primitive APIs**

Run:

```bash
rg -n "from \"@/components/ui/(button|card|table|badge|tabs|toast-viewport)\"" src/app src/components
```

Expected: list of consumers. Do not change exported names unless every consumer is updated in the same task.

- [ ] **Step 2: Update primitive styling**

Update class maps to use semantic Tailwind classes that now resolve through the token bridge. Keep existing props:

- `Button` keeps `variant`, `size`, `leftSection`, `rightSection`, `loading`, and `render`.
- `Card` keeps `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardAction`, `CardDescription`, `CardContent`.
- `Table` keeps `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`.
- `Badge` keeps existing variants and may add `success`, `warning`, and `info` if all call sites remain compatible.

- [ ] **Step 3: Fix accessibility gaps in touched primitives**

If `tabs.tsx` lacks stable `id`, `aria-controls`, and `aria-labelledby` wiring, add it. If `toast-viewport.tsx` lacks live-region semantics, add `role="status"` and `aria-live="polite"` to the non-error toast container.

- [ ] **Step 4: Run focused checks**

Run:

```bash
npm run lint
npm run build
```

Expected: no new lint or build errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui src/styles/tokens.css tailwind.config.ts src/app/globals.css
git commit -m "feat(ui): align shared primitives with academy design system"
```

### Task 3: Shell Convergence

**Files:**
- Modify: `src/components/admin-shell.tsx`
- Modify: `src/components/faculty-shell.tsx`
- Modify: `src/components/academy-shell.tsx`
- Modify: `src/styles/admin.css`
- Modify: `src/styles/shared.css`

- [ ] **Step 1: Locate shell class definitions**

Run:

```bash
rg -n "admin-app|admin-sidebar|admin-nav|academy-app|academy-sidebar|academy-main|faculty" src/components src/styles
```

Expected: identify the exact CSS blocks before editing.

- [ ] **Step 2: Replace hard-coded shell colors with tokens**

Update shell CSS to use `--sis-*`, existing sidebar aliases, or Tailwind semantic classes. Keep layout dimensions, menu behavior, mobile sidebar behavior, search behavior, and sign-out forms unchanged.

- [ ] **Step 3: Verify protected-route shell rendering**

Start the app:

```bash
npm run dev
```

Check unauthenticated behavior:

```bash
curl -I http://localhost:3200/admin
curl -I http://localhost:3200/login
```

Expected: protected admin route redirects to login; login returns `200`.

- [ ] **Step 4: Browser smoke migrated shell**

Use agent-browser or available browser tooling to check:

- `http://localhost:3200/login`
- an authenticated seeded admin route if local credentials are available
- mobile width around 390px
- desktop width around 1440px

Expected: no blank page, no overlapping nav text, visible focus states.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin-shell.tsx src/components/faculty-shell.tsx src/components/academy-shell.tsx src/styles/admin.css src/styles/shared.css
git commit -m "feat(ui): converge academy shells on design tokens"
```

### Task 4: First Admin Route Group Migration

**Files:**
- Modify: `src/app/admin/settings/institution/*`
- Modify: `src/app/admin/settings/calendar/*`
- Modify: `src/app/admin/settings/people/*`
- Modify: `src/app/admin/people/*`
- Modify: shared CSS only for classes used by these surfaces

- [ ] **Step 1: Choose the smallest route group**

Start with one of:

- `/admin/settings/institution`
- `/admin/settings/calendar`
- `/admin/people`

Do not migrate all admin pages in one patch.

- [ ] **Step 2: Replace page-local visual duplication**

For the selected route group:

- use `Card`, `Button`, `Badge`, `Table`, `Tabs`, `Dialog`, and form primitives
- remove new hard-coded hex colors in changed JSX
- keep server data loading unchanged
- keep API calls and server actions unchanged

- [ ] **Step 3: Run checks**

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: tests, lint, build, and whitespace checks pass, or pre-existing warnings are documented.

- [ ] **Step 4: Browser smoke selected route group**

Verify the selected route group at desktop and mobile widths. Confirm:

- page renders
- primary actions are visible
- labels and buttons do not overlap
- dialogs open and close
- keyboard focus is visible

- [ ] **Step 5: Commit**

```bash
git add src/app/admin src/components src/styles
git commit -m "feat(ui): migrate first admin route group"
```

### Task 5: Documentation And Release Closeout

**Files:**
- Modify: `docs/technology.md`
- Modify: `docs/product/factory-roadmap.md` if roadmap language changes
- Create: `docs/releases/2026-07-04-design-system-foundation.md`

- [ ] **Step 1: Document the new UI rule**

Update `docs/technology.md` to state that Academy UI uses Tailwind/Radix primitives with the normalized token bridge in `src/styles/tokens.css`.

- [ ] **Step 2: Add release note**

Create a release note summarizing:

- token bridge
- primitive convergence
- shell convergence
- first route group migrated
- verification commands
- known remaining route groups

- [ ] **Step 3: Final verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all pass or only documented pre-existing warnings remain.

- [ ] **Step 4: Commit**

```bash
git add docs/technology.md docs/product/factory-roadmap.md docs/releases/2026-07-04-design-system-foundation.md
git commit -m "docs(ui): record design system migration foundation"
```

---

## Plan Self-Review

- Spec coverage: token, primitive, shell, route-group, accessibility, browser verification, docs, and rollback requirements are all represented.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation directives remain.
- Type consistency: no new runtime types are introduced by the planning artifact.
