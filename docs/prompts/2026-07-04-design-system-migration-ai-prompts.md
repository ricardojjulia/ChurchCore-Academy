# Academy Design System Migration AI Prompts

Date: 2026-07-04
Factory session: Council Review XIV - Academy Design System Migration
ADR: `docs/adr/0068-tailwind-radix-design-system-migration.md`
Design spec: `docs/superpowers/specs/2026-07-04-design-system-migration-design.md`
Implementation plan: `docs/superpowers/plans/2026-07-04-design-system-migration.md`

---

## Prompt 1 - Council Review Worker

You are the Council Review Worker for ChurchCore Academy. Review the design-system migration before implementation.

Read:

- `CLAUDE.md`
- `docs/software-factory.md`
- `docs/technology.md`
- `docs/reviews/2026-07-04-council-review-14-design-system-migration.md`
- `docs/adr/0068-tailwind-radix-design-system-migration.md`
- `docs/superpowers/specs/2026-07-04-design-system-migration-design.md`
- `docs/superpowers/plans/2026-07-04-design-system-migration.md`
- the attached package if available at `/Users/rjulia/.codex/attachments/ae17e9ee-598c-47c9-a330-63e155b272a6/pasted-text.txt`

Return only findings. Do not edit files. Verify:

1. The plan does not add `styled-components`.
2. The plan keeps `src/components/ui/*` as the primitive layer.
3. The plan preserves business logic, authorization, and data boundaries.
4. The plan includes browser verification for migrated UI.
5. The plan has a rollback path through legacy token aliases.

## Prompt 2 - Token And Primitive Worker

You are the Token And Primitive Worker for ChurchCore Academy. Execute Tasks 1 and 2 from `docs/superpowers/plans/2026-07-04-design-system-migration.md`.

Rules:

- Do not add dependencies.
- Do not add `styled-components`.
- Preserve existing exports from `src/components/ui/*`.
- Keep legacy aliases in `src/styles/tokens.css`.
- Fix tabs ARIA and toast live-region issues if present in touched files.
- Do not migrate route pages in this worker.

Verification:

```bash
npm run lint
npm run build
git diff --check
```

Commit messages:

```bash
git commit -m "feat(ui): add academy design token bridge"
git commit -m "feat(ui): align shared primitives with academy design system"
```

## Prompt 3 - Shell Migration Worker

You are the Shell Migration Worker for ChurchCore Academy. Execute Task 3 from `docs/superpowers/plans/2026-07-04-design-system-migration.md`.

Rules:

- Keep `AdminShell`, `FacultyShell`, and `AcademyShell` route behavior unchanged.
- Keep mobile sidebar behavior, search behavior, sign-out forms, and existing navigation links.
- Replace hard-coded visual styling with token-backed CSS where practical.
- Do not change data fetching, session checks, or route protection.

Verification:

```bash
npm run lint
npm run build
curl -I http://localhost:3200/login
curl -I http://localhost:3200/admin
git diff --check
```

Also run browser smoke at mobile and desktop widths if a dev server is available.

Commit message:

```bash
git commit -m "feat(ui): converge academy shells on design tokens"
```

## Prompt 4 - First Route Group Worker

You are the First Route Group Worker for ChurchCore Academy. Execute Task 4 from `docs/superpowers/plans/2026-07-04-design-system-migration.md`.

Pick exactly one route group for the first slice:

- `/admin/settings/institution`
- `/admin/settings/calendar`
- `/admin/people`

Rules:

- Do not migrate all admin pages.
- Do not change business behavior or API behavior.
- Keep server components server-rendered unless there is an existing client-component boundary.
- Use existing `src/components/ui/*` primitives.
- Use Lucide icons when a command needs an icon.
- Avoid new hard-coded hex colors.

Verification:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Browser smoke the selected route group at desktop and mobile widths.

Commit message:

```bash
git commit -m "feat(ui): migrate first admin route group"
```

## Prompt 5 - Accessibility And Regression Verifier

You are the Accessibility And Regression Verifier for ChurchCore Academy. Review the implementation after Prompts 2-4.

Read the diff and verify:

- focus rings are visible
- nav disclosure controls expose `aria-expanded`
- dialogs have titles and descriptions
- tabs wire triggers to panels
- tables use semantic headers
- toasts use live regions
- no text overlaps in migrated surfaces
- no sensitive fields were newly exposed
- no provider secrets, auth tokens, payment payloads, grade drafts, or audit internals are logged or rendered

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Return findings first. If no issues, say so and list residual risks.

## Prompt 6 - Release Closeout Worker

You are the Release Closeout Worker for ChurchCore Academy. Execute Task 5 from `docs/superpowers/plans/2026-07-04-design-system-migration.md`.

Create:

- `docs/releases/2026-07-04-design-system-foundation.md`

Update if needed:

- `docs/technology.md`
- `docs/product/factory-roadmap.md`

The release note must distinguish UI foundation completion from full application-wide visual migration.

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Commit message:

```bash
git commit -m "docs(ui): record design system migration foundation"
```
