# Competitive Acceptance Role Matrix Plan

Date: 2026-06-21  
Spec: `docs/superpowers/specs/2026-06-21-competitive-acceptance-role-matrix-design.md`  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`

## Objective

Implement ADR-0038 Prompt 1 by creating a role-matrix acceptance checklist and executable acceptance inventory for the primary ChurchCore Academy SIS roles.

## Tasks

- [x] Read ADR-0038, the prompt pack, and `docs/software-factory.md`.
- [x] Inspect current auth policy, role names, protected-route proxy, and SIS route families.
- [x] Add the `finance` Academy role required by ADR-0038 acceptance.
- [x] Permit finance access in billing, financial-aid, communications, and reporting policy surfaces.
- [x] Add `src/modules/acceptance/role-matrix.ts` as the executable route/API inventory.
- [x] Add focused role-matrix tests.
- [x] Add `docs/acceptance/role-matrix-checklist.md`.
- [x] Update project status and factory roadmap to record Prompt 1 completion.
- [x] Run focused acceptance tests.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run protected-route HTTP smoke when the dev server is available.

## Acceptance Criteria

- The matrix includes admin, registrar, faculty, student, guardian, finance, admissions, and platform admin.
- Each role has required and forbidden route surfaces.
- Each surface records expected unauthenticated behavior, allowed roles, denied roles, data boundary, and evidence command.
- Finance is not documentation-only; it is represented in the runtime Academy role type and finance workflow policy.
- The slice does not overstate completion: authenticated browser walkthroughs and live-tenant rehearsal remain later ADR-0038 work.

## Evidence Commands

```bash
node --import tsx --test src/modules/acceptance/__tests__/role-matrix.test.ts
npm test
npm run lint
npm run build
curl -I http://localhost:3200/admin
curl -I http://localhost:3200/student
curl -I http://localhost:3200/guardian
curl -I http://localhost:3200/faculty
curl -I http://localhost:3200/platform/control
```
