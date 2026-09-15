# Council Review XIV - Academy Design System Migration

Date: 2026-07-04
Branch: local planning package
Baseline: local working tree on 2026-07-04
Scope: Attached SIS design-system package, Academy UI primitives, shell styling, accessibility, and software-factory execution path.
Decision Requested: Should ChurchCore Academy adopt the attached design-system package, and if so, how should execution proceed?

## Executive Verdict

Decision: approve with constraints
Release status: design-system foundation
Confidence: high

The council approves adopting the attached SIS design-system package as source material for ChurchCore Academy's UI modernization. The council rejects importing it wholesale as `styled-components`, plain HTML/CSS snippets, or a separate internal npm package for this repo. The approved path is a Tailwind/Radix migration that normalizes tokens, updates existing primitives, converges shells, and migrates product surfaces in controlled slices.

## Evidence Reviewed

- Attached design-system package in `/Users/rjulia/.codex/attachments/ae17e9ee-598c-47c9-a330-63e155b272a6/pasted-text.txt`
- `CLAUDE.md`
- `docs/software-factory.md`
- `docs/technology.md`
- `tailwind.config.ts`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/styles/tokens.css`
- `src/styles/shared.css`
- `src/styles/admin.css`
- `src/styles/student-pwa.css`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/badge.tsx`
- `src/components/admin-shell.tsx`
- `src/components/academy-shell.tsx`
- `src/components/faculty-shell.tsx`

## Product Council

Recommendation: approve.

ChurchCore Academy needs a more cohesive and competitive operational interface. The attached package provides a useful SIS vocabulary: app shell, navigation, cards, data tables, forms, toasts, and accessibility rules. This aligns with the product goal of a faith-based SIS that feels serious, mature, and usable by registrars, faculty, admissions staff, finance staff, guardians, and students.

Condition: migration must preserve the Academy product identity. Do not turn the app into a generic university dashboard. Faith-based education surfaces still need language and workflows grounded in Academy's domain.

## SIS Domain Council

Recommendation: approve with no business-logic changes.

The design-system migration is a presentation and interaction-layer change. It must not alter grading rules, student records, admissions state, LMS provider contracts, institution mode packs, guardianship behavior, billing, aid, or reporting semantics. The safest execution order is shell and primitive migration first, then route-group migration.

## Architecture Council

Recommendation: approve Tailwind/Radix adaptation; reject styled-components.

The repo already owns its UI foundation through Tailwind, Radix primitives, Lucide icons, and local components. Adding `styled-components` would create a second styling runtime and split future maintenance. The attached design package should be translated into:

- CSS variables in `src/styles/tokens.css`
- Tailwind semantic mappings in `tailwind.config.ts`
- updates to `src/components/ui/*`
- shell-level CSS convergence in existing shell files and style sheets

## Security And Privacy Council

Recommendation: approve with route and data-boundary safeguards.

Visual migration must not expose sensitive data that current pages intentionally hide. Date of birth, grades, financial records, aid status, guardian authority, LMS tokens, provider errors, and audit metadata remain governed by existing modules and policies. Do not replace server-rendered protected surfaces with client-only data fetching unless the implementation plan explicitly preserves authorization and session behavior.

## UX And Accessibility Council

Recommendation: approve and require accessibility gates.

The package's accessibility checklist should become acceptance criteria, not optional advice. The first primitive pass must verify focus rings, dialog labeling, table semantics, tab relationships, nav disclosure state, form labels, and toast live regions. Existing known issues such as incomplete tabs ARIA wiring should be fixed while touching the primitive layer.

## Operations And Release Council

Recommendation: approve as a multi-slice factory program.

This should not be one large visual patch. The factory should execute:

1. Token bridge and primitive audit.
2. Primitive migration with tests.
3. Admin shell visual convergence.
4. First admin route-group migration.
5. Accessibility and browser smoke verification.
6. Documentation and release closeout.

## Wildcard Review

Objection: a visual migration could distract from remaining production maturity gaps.

Response: accepted. The factory prompt must state that visual polish does not change production-readiness claims. Current release posture remains evidence-gated.

Objection: the attached package uses generic colors and components.

Response: accepted. Use it as design-system input, not as brand law. Academy tokens can preserve current brand feel while improving consistency.

Objection: broad CSS edits can create regressions.

Response: accepted. Keep legacy aliases during migration, migrate route groups incrementally, and verify in browser.

## Decision

The council approves the design-system migration under ADR-0068.

Required constraints:

- Do not add `styled-components`.
- Do not create a separate UI package in this repo.
- Keep `src/components/ui/*` as the primitive layer.
- Keep existing shells and converge them gradually.
- Preserve all business logic, authorization, and data boundaries.
- Execute via software factory using the generated plan and prompts.

## Required Artifacts

- ADR-0068 for the Tailwind/Radix design-system migration decision.
- Design spec for token, primitive, shell, and route-group migration.
- Implementation plan under `docs/superpowers/plans/`.
- AI prompts for council/review, token primitive worker, shell worker, route worker, accessibility verifier, and release worker.
- Single factory prompt that can execute the full approved change.

## Verdict

Approved. Proceed to ADR and factory execution planning. Implementation may begin only through the software-factory prompt and must preserve runtime behavior while improving UI consistency and accessibility.
