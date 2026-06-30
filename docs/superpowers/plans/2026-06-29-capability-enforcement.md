# Implementation Plan: Institution Capability Enforcement

**Date:** 2026-06-29
**ADR:** 0061
**Spec:** `docs/superpowers/specs/2026-06-29-capability-enforcement-design.md`
**Council Review:** `docs/reviews/council-review-3-capability-enforcement.md`
**Branch:** `feature/capability-enforcement`

---

## Factory Intake

Feature: Wire institution capability flags as actual runtime enforcement gates
Product area: Institution configuration × auth × all capability-guarded domains
Primary users: Institution admins (configuration effect), end users (feature availability)
Institution modes affected: All — each mode pack sets capability flags; this plan makes those flags do something
Data touched: `academy_institution_profiles.capabilities` (read only — no schema change)
LMS provider impact: `lmsLaunch`, `lmsRosterSync`, `lmsGradeReturn` capabilities gated
Student PWA impact: `studentPwa` capability gate added to student route layer
ShepherdAI impact: `shepherdAiRecommendations` capability gate added to ShepherdAI routes
Auth and privacy risks: Low — additive check, does not weaken existing role gates

---

## Pre-flight

Before starting:

1. Confirm `academy_institution_profiles` table has a `capabilities` JSONB column — verified by migration `20260624060000`.
2. Confirm demo tenant `cca-main` has all capabilities set to `true` via mode-pack defaults — so no demo breakage.
3. Confirm `handleApi` in `src/app/api/academy/api-utils.ts` has a catch block that can be extended.

---

## Tasks

### Task 1 — `CapabilityDisabledError` and `assertCapability` in policy

**File:** `src/modules/academy-auth/policy.ts`

Add after the existing `assertStudentPortalAccess` function:

```typescript
import type { InstitutionCapabilitySet } from "@/modules/academy-config/types";

export class CapabilityDisabledError extends Error {
  readonly statusCode = 451;
  constructor(readonly capability: string) {
    super(`Capability '${capability}' is not enabled for this institution.`);
  }
}

export function assertCapability(
  capabilities: InstitutionCapabilitySet,
  key: keyof InstitutionCapabilitySet,
): void {
  if (!capabilities[key]) {
    throw new CapabilityDisabledError(key);
  }
}
```

Tests to add in `src/modules/academy-auth/__tests__/capability-enforcement.test.ts`:
- passes when flag is true
- throws `CapabilityDisabledError` when flag is false
- thrown error has `statusCode === 451`
- thrown error message contains the capability key

---

### Task 2 — `withCapabilityContext` and `fetchCapabilitySet`

**File:** `src/lib/capability-context.ts` (new)

See spec for full implementation. Key points:
- `fetchCapabilitySet(client, tenantId)` — single-row JSONB select
- `withCapabilityContext(actor, handler)` — wraps `withAcademyDatabaseContext`, fetches capability set, injects into handler
- Handler signature: `(client, capabilities) => Promise<T>`

Tests in `src/lib/__tests__/capability-context.test.ts`:
- returns capability set for known tenant
- throws when profile missing
- passes capabilities to handler

---

### Task 3 — `handleApi` catches `CapabilityDisabledError`

**File:** `src/app/api/academy/api-utils.ts`

Extend the error catch block:

```typescript
import { CapabilityDisabledError } from "@/modules/academy-auth/policy";

// In catch block, before generic 500 handler:
if (error instanceof CapabilityDisabledError) {
  return NextResponse.json(
    { available: false, capability: error.capability, reason: "Not enabled for this institution." },
    { status: 451 },
  );
}
```

No tests needed beyond the integration behavior — the error shape is covered by Task 1 tests.

---

### Task 4 — `CapabilityGhostPage` component

**File:** `src/components/ui/CapabilityGhostPage.tsx` (new)

Renders a centered "not available" screen for admin pages behind disabled capabilities.
Props: `capability: string`, `institutionModel: string`.
Includes a `<Link href="/admin/settings/institution">` for navigation back.

Add Ghost Mode CSS rules to `src/styles/admin.css`:
```css
.ops-ghost-page { ... }
.ops-ghost-icon { ... }
.ops-ghost-title { ... }
.ops-ghost-detail { ... }
.ops-ghost-link { ... }
```

See spec for exact CSS values.

---

### Task 5 — Route enforcement: LMS routes

**Files:** LMS-related API routes under `src/app/api/academy/lms/`

Locate all route files. Wrap each handler in `withCapabilityContext`. Add `assertCapability` call:

- `lmsLaunch` routes → `assertCapability(capabilities, "lmsLaunch")`
- `lmsRosterSync` routes → `assertCapability(capabilities, "lmsRosterSync")`
- `lmsGradeReturn` routes → `assertCapability(capabilities, "lmsGradeReturn")`

LMS routes are the highest-impact capability gates — enforcing them stops a no-LMS tenant from triggering LMS operations even if a malicious request bypasses the UI.

---

### Task 6 — Route enforcement: ShepherdAI routes

**Files:** ShepherdAI API routes under `src/app/api/academy/shepherd/` (or equivalent)

Wrap each handler with `withCapabilityContext`. Add `assertCapability(capabilities, "shepherdAiRecommendations")` after `assertShepherdAiAccess`.

---

### Task 7 — Route enforcement: Student PWA routes

**Files:** Student-facing API routes under `src/app/api/academy/student/`

Extend `assertStudentPortalAccess` signature to accept an optional `capabilities` parameter:

```typescript
export function assertStudentPortalAccess(
  actor: AcademyActor,
  capabilities?: InstitutionCapabilitySet,
): void {
  if (!actor.roles.includes("student")) throw new Error("Forbidden student portal access.");
  if (capabilities) assertCapability(capabilities, "studentPwa");
}
```

Update student routes to pass capabilities from `withCapabilityContext` into `assertStudentPortalAccess`.

---

### Task 8 — Route enforcement: Guardian, Faculty, workflow routes

**Files:** 
- `src/app/api/academy/guardian/**` → `guardianPortal`
- `src/app/api/academy/faculty/**` → `facultyPortal`
- `src/app/api/academy/registrar/**` → `registrarWorkflows`
- `src/app/api/academy/admissions/**` → `admissionsWorkflows`
- `src/app/api/academy/transcripts/**` → `transcriptWorkflows`
- `src/app/api/academy/graduation/**` → `graduationWorkflows`

For each file group:
1. Find all route.ts files in the directory
2. Replace `withAcademyDatabaseContext` with `withCapabilityContext`
3. Add `assertCapability(capabilities, "<key>")` at the top of the handler, after actor resolution

Note: Some directories may not exist yet if the feature is not built. Log as "no routes found — gate pending" and move on.

---

### Task 9 — Capability badge update in `ValidationTile`

**File:** `src/app/admin/settings/institution/ValidationTile.tsx`

The capabilities section currently shows "Enabled" / "Off" badges. Add a visual indicator that "Off" capabilities are now actually enforced (not just display). Update the badge description text:

```tsx
<Badge variant={item.status === "enabled" ? "secondary" : "outline"}>
  {item.status === "enabled" ? "Enabled" : "Off — enforced"}
</Badge>
```

Small UX detail that closes the loop between the audit finding and the admin UI.

---

### Task 10 — Verification

Run in order:

```bash
npm test
npm run lint
npm run build
```

Manual check:
1. Start dev server: `npm run dev`
2. With demo tenant (all capabilities `true`): confirm all routes still respond normally.
3. To test enforcement: temporarily patch `capabilities.shepherdAiRecommendations` to `false` in the DB and confirm the ShepherdAI route returns 451.
4. Revert the test patch.

---

## Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Route directories don't exist yet (feature not built) | Medium | Task 8 handles this: log "no routes found" and continue |
| Demo tenant capability flags cause breakage | Low | All demo caps are `true`; no production breakage expected |
| `handleApi` catch order wrong (capability caught as 500) | Low | Add CapabilityDisabledError check before generic catch in Task 3 |
| Missing import of `InstitutionCapabilitySet` in policy.ts | Low | Task 1 explicitly adds the import |

---

## Delivery Checklist

- [ ] `CapabilityDisabledError` and `assertCapability` in `policy.ts`
- [ ] `withCapabilityContext` and `fetchCapabilitySet` in `src/lib/capability-context.ts`
- [ ] `handleApi` catches `CapabilityDisabledError` with 451
- [ ] `CapabilityGhostPage` component created
- [ ] Ghost Mode CSS added to `admin.css`
- [ ] LMS routes enforced (lmsLaunch, lmsRosterSync, lmsGradeReturn)
- [ ] ShepherdAI routes enforced
- [ ] Student PWA routes enforced
- [ ] Guardian / Faculty / workflow routes enforced (where routes exist)
- [ ] `assertStudentPortalAccess` extended with optional capabilities param
- [ ] `ValidationTile` badge updated to "Off — enforced"
- [ ] Tests added for policy, capability-context, route behavior
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] 451 response confirmed manually on a gated route
