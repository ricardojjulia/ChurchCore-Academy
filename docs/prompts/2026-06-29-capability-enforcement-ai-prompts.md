# Capability Enforcement AI Prompts

Use these prompts to run the capability enforcement plan through focused AI workers or separate sessions.
Each prompt is self-contained. Workers should not edit files outside their assigned scope.

---

## Prompt 1 — Architecture Worker (Tasks 1–4)

You are the Architecture Worker for ChurchCore Academy capability enforcement.

Read the following before starting:
- `docs/adr/0061-institution-capability-enforcement.md`
- `docs/superpowers/specs/2026-06-29-capability-enforcement-design.md`
- `docs/superpowers/plans/2026-06-29-capability-enforcement.md` (Tasks 1–4)
- `src/modules/academy-auth/policy.ts` (existing patterns)
- `src/lib/academy-database-context.ts` (existing `withAcademyDatabaseContext` pattern)
- `src/app/api/academy/api-utils.ts` (existing `handleApi` catch block)

Implement Tasks 1 through 4:

**Task 1:** Add `CapabilityDisabledError` class and `assertCapability` function to `src/modules/academy-auth/policy.ts`. Import `InstitutionCapabilitySet` from `@/modules/academy-config/types`. Write tests in `src/modules/academy-auth/__tests__/capability-enforcement.test.ts`.

**Task 2:** Create `src/lib/capability-context.ts` with `fetchCapabilitySet` (tenant-scoped JSONB select from `academy_institution_profiles`) and `withCapabilityContext` (wraps `withAcademyDatabaseContext`, injects capability set). Write tests in `src/lib/__tests__/capability-context.test.ts`.

**Task 3:** Extend the catch block in `src/app/api/academy/api-utils.ts` to catch `CapabilityDisabledError` and return HTTP 451 with `{ available: false, capability, reason }`.

**Task 4:** Create `src/components/ui/CapabilityGhostPage.tsx` with props `capability: string` and `institutionModel: string`. Add Ghost Mode CSS classes to `src/styles/admin.css`.

Rules:
- Use `node:test` and `node:assert/strict`. No Jest, no Vitest.
- Do not edit files outside the scope above.
- Do not refactor unrelated code.
- Run `npm test && npm run lint` after each task. Report exact output.

Return: changed files, test results, lint results, any risks found.

---

## Prompt 2 — LMS and ShepherdAI Route Enforcement Worker (Tasks 5–6)

You are the LMS and ShepherdAI Route Enforcement Worker for ChurchCore Academy.

Read the following before starting:
- `docs/superpowers/plans/2026-06-29-capability-enforcement.md` (Tasks 5–6)
- `src/lib/capability-context.ts` (produced by Architecture Worker — read it before starting)
- `src/modules/academy-auth/policy.ts` (read `assertCapability` and `CapabilityDisabledError`)
- `src/app/api/academy/api-utils.ts` (read `handleApi`)

Find all route files under:
- `src/app/api/academy/lms/` (or search for lms-related route.ts files)
- `src/app/api/academy/shepherd/` (or search for shepherd-related route.ts files)

For each file:
1. Replace `withAcademyDatabaseContext` with `withCapabilityContext` from `@/lib/capability-context`.
2. Update the handler signature to `(client, capabilities)`.
3. Add `assertCapability(capabilities, "<key>")` immediately after actor resolution and role/config assertion.
   - LMS launch routes: `"lmsLaunch"`
   - LMS roster routes: `"lmsRosterSync"`
   - LMS grade return routes: `"lmsGradeReturn"`
   - ShepherdAI routes: `"shepherdAiRecommendations"`

If a route directory does not exist (feature not yet built), log it as "no routes found — gate pending" and continue.

Rules:
- Do not edit `src/lib/capability-context.ts` or `src/modules/academy-auth/policy.ts` — those are owned by the Architecture Worker.
- Do not add capability gates to routes that are not in the LMS or ShepherdAI groups.
- Run `npm test && npm run lint` after completing all route updates.

Return: list of files changed, capability key applied, routes skipped (not found), test and lint results.

---

## Prompt 3 — Student PWA, Guardian, Faculty, and Workflow Route Enforcement Worker (Tasks 7–8)

You are the Student, Guardian, Faculty, and Workflow Route Enforcement Worker for ChurchCore Academy.

Read the following before starting:
- `docs/superpowers/plans/2026-06-29-capability-enforcement.md` (Tasks 7–8)
- `src/lib/capability-context.ts` (Architecture Worker output)
- `src/modules/academy-auth/policy.ts` (read `assertStudentPortalAccess` and `assertCapability`)

**Task 7:** Extend `assertStudentPortalAccess` in `src/modules/academy-auth/policy.ts` to accept an optional second argument `capabilities?: InstitutionCapabilitySet`. When provided, call `assertCapability(capabilities, "studentPwa")` after the role check. Update student API routes under `src/app/api/academy/student/` to use `withCapabilityContext` and pass capabilities to `assertStudentPortalAccess`.

**Task 8:** For each of the following route groups, find all route.ts files, switch to `withCapabilityContext`, and add `assertCapability` with the specified key:
- `src/app/api/academy/guardian/**` → `"guardianPortal"`
- `src/app/api/academy/faculty/**` → `"facultyPortal"`
- `src/app/api/academy/registrar/**` → `"registrarWorkflows"`
- `src/app/api/academy/admissions/**` → `"admissionsWorkflows"`
- `src/app/api/academy/transcripts/**` → `"transcriptWorkflows"`
- `src/app/api/academy/graduation/**` → `"graduationWorkflows"`

If a directory does not exist, log "no routes found — gate pending" and continue.

Rules:
- Do not change the behavior of the role check. Only add the capability check after it.
- Do not edit LMS or ShepherdAI routes (owned by Prompt 2 worker).
- Run `npm test && npm run lint` after all changes.

Return: files changed, capability key applied, routes skipped, test and lint results.

---

## Prompt 4 — UI Polish and Validation Worker (Task 9 + Verification)

You are the UI Polish and Verification Worker for ChurchCore Academy capability enforcement.

Read the following before starting:
- `docs/superpowers/plans/2026-06-29-capability-enforcement.md` (Task 9 and verification section)
- `src/app/admin/settings/institution/ValidationTile.tsx`

**Task 9:** In `ValidationTile.tsx`, update the capability badge for the "Off" state:
- Change: `{item.status === "enabled" ? "Enabled" : "Off"}`
- To: `{item.status === "enabled" ? "Enabled" : "Off — enforced"}`

This is a one-line change. Do not touch anything else in the file.

**Verification:**

Run the full verification suite:

```bash
npm test
npm run lint
npm run build
```

Report exact output of all three commands.

Then report:
- Total test count
- Any lint warnings (not just errors)
- Build output — zero TypeScript errors required
- Any routes that were logged as "no routes found — gate pending" by earlier workers (compile this list from their reports)
- Whether demo tenant capability pass-through is safe (all caps `true` means no demo breakage)

Return a single delivery summary matching the format in `docs/software-factory.md` (Feature Factory Template: Verification Plan section).

---

## Orchestration Note

Run Prompts 1, then 2 and 3 in parallel, then 4.

Prompt 1 must complete before 2 and 3 start because both depend on `src/lib/capability-context.ts` and the updated `policy.ts`.

Prompt 4 runs last and owns final verification across all workers' output.
