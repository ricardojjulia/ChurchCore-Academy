---
name: build-with-tests
description: Use this skill when implementing a feature or extending existing ChurchCore Academy behaviour. Reads CLAUDE.md and the technical brief first, matches existing module patterns, writes production code with unit tests alongside it, then runs npm test, npm run lint, and npm run build at the end. Triggers on: "build", "implement", "add", "extend", "ship the feature".
---

## Process

1. **Read CLAUDE.md** to know the project rules, stack, and don't-do list.

2. **Read the technical brief** and confirm the scope before touching any file.

3. **Inspect 2–3 similar existing implementations** in `src/modules/`. Note:
   - How the module function signature looks
   - How tenant isolation is enforced (always before repository access)
   - How errors are thrown and surfaced
   - How tests are structured in `__tests__/`
   - What test data helpers exist in the module's defaults file

4. **Implement in the smallest coherent steps.** For each step:
   - Write the production code inside `src/modules/<domain>/`
   - Write a unit test in `src/modules/<domain>/__tests__/` that covers the new behaviour
   - Run `npm test` and confirm the new test passes before moving on

5. **When the feature is complete, run all three gates:**
   ```
   npm test
   npm run lint
   npm run build
   ```

6. **Return a short summary:**
   - Files added / edited
   - Patterns reused (cite the similar implementation you followed)
   - Tenant isolation enforcement point confirmed
   - Student/guardian data safety assertions added (if applicable)
   - Any CLAUDE.md rule worth adding

## Conventions for this codebase

**Module structure:**
- `types.ts` — TypeScript interfaces and types for this domain
- `validation.ts` — pure validation functions, no DB
- `repository.ts` or `postgres-repository.ts` — DB access only, no business logic
- `service.ts` — orchestration of validation + repository
- `__tests__/` — unit tests named `<concern>.test.ts`
- Migrations under `supabase/migrations/` with timestamp prefix

**Tenant isolation pattern:**
```typescript
if (actor.tenantId !== requestedTenantId) {
  throw new Error("Forbidden ...");
}
```
This check appears in every module function before any repository call.

**Test file pattern:**
```typescript
import assert from "node:assert/strict";
import test from "node:test";
// inline data or createXxxDefaults helpers
// every test: success case + rejection/validation case + cross-tenant rejection case
```

**Secret safety in tests:**
```typescript
assert.doesNotMatch(JSON.stringify(result), /accessToken|credentialSecret|rawProviderPayload/i);
```

## Rules

- Do not refactor unrelated code.
- Do not change files outside the agreed scope.
- Do not add new dependencies without explicit instruction.
- If tests cannot pass without violating a rule, stop and report the conflict.
