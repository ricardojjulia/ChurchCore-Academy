# Design Spec: Institution Capability Enforcement

**Date:** 2026-06-29
**Phase:** Post Phase 1 hardening
**ADR:** 0061
**Council review:** `docs/reviews/council-review-3-capability-enforcement.md`

---

## Problem

All 11 `InstitutionCapabilitySet` flags are display-only. Runtime access is gated by role only. The institution mode and mode-pack configuration model has no runtime effect.

## Goal

Wire capabilities as actual enforcement gates at the API route layer. The implementation must be:

- Centralized (one fetch, one assert function)
- Additive (layered on top of existing role checks)
- Graceful (Ghost Mode UX, not hard 403 errors)
- Auditable (every guarded route calls the same pattern)

---

## Data Flow

```
Request
  └── resolveAcademyActorFromSession()  → AcademyActor (role + tenantId)
  └── withCapabilityContext()
        ├── withAcademyDatabaseContext() → client
        ├── fetchCapabilitySet(client, actor.tenantId) → InstitutionCapabilitySet
        └── handler(client, capabilities)
              └── assertCapability(capabilities, "graduationWorkflows")
                    ├── capabilities.graduationWorkflows === true → continue
                    └── false → throw CapabilityDisabledError { capability, statusCode: 451 }
  └── handleApi() catches CapabilityDisabledError → 451 JSON response
```

---

## New Files

### `src/lib/capability-context.ts`

```typescript
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { InstitutionCapabilitySet } from "@/modules/academy-config/types";

type CapabilityQueryable = {
  query(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

export async function fetchCapabilitySet(
  client: CapabilityQueryable,
  tenantId: string,
): Promise<InstitutionCapabilitySet> {
  const result = await client.query(
    `select capabilities from academy_institution_profiles where tenant_id = $1`,
    [tenantId],
  );
  if (!result.rows[0]) throw new Error(`Institution profile not found for tenant ${tenantId}.`);
  return result.rows[0].capabilities as InstitutionCapabilitySet;
}

export async function withCapabilityContext<T>(
  actor: AcademyActor,
  handler: (client: CapabilityQueryable, capabilities: InstitutionCapabilitySet) => Promise<T>,
): Promise<T> {
  return withAcademyDatabaseContext(actor, async (rawClient) => {
    const client = asAcademyDatabase<CapabilityQueryable>(rawClient);
    const capabilities = await fetchCapabilitySet(client, actor.tenantId);
    return handler(client, capabilities);
  });
}
```

### `src/components/ui/CapabilityGhostPage.tsx`

```typescript
"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

interface CapabilityGhostPageProps {
  capability: string;
  institutionModel: string;
}

export function CapabilityGhostPage({ capability, institutionModel }: CapabilityGhostPageProps) {
  return (
    <div className="ops-ghost-page">
      <Lock className="ops-ghost-icon" />
      <h2 className="ops-ghost-title">Not available for your institution</h2>
      <p className="ops-ghost-detail">
        <strong>{capability}</strong> is not enabled for <strong>{institutionModel}</strong>.
      </p>
      <Link href="/admin/settings/institution" className="ops-ghost-link">
        Review institution configuration →
      </Link>
    </div>
  );
}
```

---

## Modified Files

### `src/modules/academy-auth/policy.ts`

Add `CapabilityDisabledError` class and `assertCapability` function:

```typescript
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

### `src/app/api/academy/api-utils.ts`

Extend `handleApi` to catch `CapabilityDisabledError`:

```typescript
import { CapabilityDisabledError } from "@/modules/academy-auth/policy";

// inside handleApi catch block:
if (error instanceof CapabilityDisabledError) {
  return NextResponse.json(
    { available: false, capability: error.capability, reason: "Not enabled for this institution." },
    { status: 451 },
  );
}
```

### `src/app/api/academy/api-utils.ts` — `assertStudentPortalAccess` extension

After role check, also check `studentPwa` capability:

```typescript
export function assertStudentPortalAccess(
  actor: AcademyActor,
  capabilities?: InstitutionCapabilitySet,
): void {
  if (!actor.roles.includes("student")) {
    throw new Error("Forbidden student portal access.");
  }
  if (capabilities) {
    assertCapability(capabilities, "studentPwa");
  }
}
```

---

## Route Enforcement Map

Each route below must be updated to use `withCapabilityContext` and call `assertCapability` after actor resolution.

| File pattern | Capability |
|---|---|
| `src/app/api/academy/student/**` | `studentPwa` |
| `src/app/api/academy/guardian/**` | `guardianPortal` |
| `src/app/api/academy/faculty/**` | `facultyPortal` |
| `src/app/api/academy/registrar/**` | `registrarWorkflows` |
| `src/app/api/academy/admissions/**` | `admissionsWorkflows` |
| `src/app/api/academy/transcripts/**` | `transcriptWorkflows` |
| `src/app/api/academy/graduation/**` | `graduationWorkflows` |
| `src/app/api/academy/lms/launch/**` | `lmsLaunch` |
| `src/app/api/academy/lms/roster/**` | `lmsRosterSync` |
| `src/app/api/academy/lms/grades/**` | `lmsGradeReturn` |
| `src/app/api/academy/shepherd/**` | `shepherdAiRecommendations` |

---

## CSS (Ghost Mode)

Add to `src/styles/admin.css`:

```css
.ops-ghost-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 40vh;
  text-align: center;
  color: var(--muted-foreground);
}
.ops-ghost-icon { width: 2.5rem; height: 2.5rem; opacity: 0.4; }
.ops-ghost-title { font-size: 1.125rem; font-weight: 600; }
.ops-ghost-detail { font-size: 0.875rem; max-width: 28rem; }
.ops-ghost-link { font-size: 0.875rem; color: var(--primary); text-decoration: underline; }
```

---

## Tests

### `src/modules/academy-auth/__tests__/capability-enforcement.test.ts`

- `assertCapability` passes when flag is `true`
- `assertCapability` throws `CapabilityDisabledError` when flag is `false`
- `CapabilityDisabledError` has `statusCode === 451`
- `assertCapability` name in error matches the key

### `src/lib/__tests__/capability-context.test.ts`

- `fetchCapabilitySet` returns capability set for known tenant
- `fetchCapabilitySet` throws when profile missing
- `withCapabilityContext` passes capabilities to handler

---

## Verification Commands

```bash
npm test
npm run lint
npm run build
```

Manual: confirm that calling a capability-gated route with the capability set to `false` in the demo tenant returns HTTP 451 with `{ available: false, capability: "...", reason: "..." }`.

---

## Out of Scope (Phase 2)

- Student PWA nav capability-aware hiding
- Full Ghost Mode admin page for every capability group
- Institution settings tile deep-link to individual capability setting
- Capability toggle UI on the institution settings page (capabilities are set by mode packs)
