# ADR 0068: Tailwind And Radix Design System Migration

Date: 2026-07-04
Status: accepted

---

## Context

ChurchCore Academy received a complete SIS design-system package containing tokens, plain CSS, React `styled-components`, accessibility guidance, routing notes, and component examples. The package is useful, but the current application already uses Next.js App Router, React, Tailwind CSS, Radix foundations, Lucide icons, and repository-owned UI primitives.

The app also has several overlapping style layers: `tailwind.config.ts`, `src/app/globals.css`, `src/styles/tokens.css`, `src/styles/shared.css`, `src/styles/admin.css`, `src/styles/student-pwa.css`, `src/components/ui/*`, and product shell components. Without a durable decision, adopting the package could create a parallel design system and increase UI inconsistency.

---

## Decision

ChurchCore Academy will adopt the attached SIS design-system package as source material, not as a runtime dependency or copied component library.

The implementation path is:

1. Normalize design tokens in `src/styles/tokens.css`.
2. Map Tailwind semantic colors, radii, shadows, and fonts to the normalized token layer in `tailwind.config.ts`.
3. Keep `src/components/ui/*` as the canonical primitive layer.
4. Update existing primitives to reflect the approved token and accessibility rules.
5. Converge `AdminShell`, `FacultyShell`, and `AcademyShell` using shared tokens and existing route structure.
6. Migrate pages by route group, beginning with admin settings and core admin workflows.
7. Preserve legacy CSS aliases until dependent surfaces have migrated.

The implementation will not add `styled-components`, create an internal npm package, or copy the package's plain HTML/CSS snippets into the app.

---

## Consequences

**Easier:**

- Future UI work has one token and primitive path.
- Admin, faculty, student, guardian, and platform surfaces can converge without replacing route architecture.
- Accessibility expectations become easier to enforce through shared primitives.
- The app can feel more competitive while preserving Academy-specific domain language.

**Harder:**

- Existing large CSS files must be migrated carefully.
- Some components will need temporary compatibility classes.
- Route-group migration requires browser verification to catch visual regressions.

**Safer:**

- No second styling runtime is introduced.
- Business logic, data access, RLS, and authorization remain untouched.
- Legacy aliases allow incremental rollback.

**Riskier:**

- Broad primitive changes can affect many pages. This is mitigated by phased execution, tests, lint, build, and browser smoke checks.

---

## Alternatives Considered

**Import the package as `styled-components`:** Rejected. It adds a second styling model to a Tailwind/Radix app and increases maintenance cost.

**Create an internal UI npm package:** Rejected for this repo. The current product does not need package boundaries for a single application codebase.

**Copy the plain HTML/CSS snippets:** Rejected. It would duplicate primitives and bypass existing React, Radix, and route-shell patterns.

**Do nothing:** Rejected. The current UI has useful foundations but too many overlapping visual layers for long-term product consistency.

---

## Review Notes

- Product boundary: UI system only. No change to SIS business behavior.
- Security/privacy: Do not expose additional sensitive data during visual migration.
- Testing: Run primitive tests where available, `npm test`, `npm run lint`, `npm run build`, and browser smoke checks for migrated surfaces.
- Rollback: Keep legacy token aliases and migrate route groups in small commits.
