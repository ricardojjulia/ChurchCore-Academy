# ADR 0061: Institution Capability Enforcement via Capability Context and Ghost Mode

Date: 2026-06-29
Status: accepted

## Context

ChurchCore Academy defines 11 institution capability flags in `InstitutionCapabilitySet`:

- `studentPwa`, `guardianPortal`, `facultyPortal`
- `registrarWorkflows`, `admissionsWorkflows`, `transcriptWorkflows`, `graduationWorkflows`
- `lmsLaunch`, `lmsRosterSync`, `lmsGradeReturn`
- `shepherdAiRecommendations`

A codebase audit on 2026-06-29 confirmed that all 11 flags are display-only. Runtime access is gated entirely by role through `academy-auth/policy.ts`. The flags have no effect on what API routes or pages a user can actually reach.

This undermines the core value of the institution mode system (ADR 0060). A Bible school tenant with `lmsLaunch: false` can access LMS launch routes. A children's school tenant with `graduationWorkflows: false` can trigger graduation workflows. The multi-mode configuration model is purely cosmetic at runtime.

The institution settings page now surfaces these flags to admins. Showing "LMS launch: Off" while the route still responds is misleading and erodes trust in the configuration model.

Capability enforcement was deferred in the original institution config implementation as a known shortcut. This ADR closes that gap.

## Decision

ChurchCore Academy will enforce institution capabilities at the API route layer as a second gate layered on top of role-based access control. Capabilities do not replace role checks; they narrow what is available within a role.

### 1. Capability Context

Introduce `withCapabilityContext` in `src/lib/capability-context.ts`. This function wraps `withAcademyDatabaseContext`, fetches the institution capability set once per request (tenant-scoped), and passes it into the handler alongside the database client.

```
withCapabilityContext(actor, async (client, capabilities) => {
  assertCapability(capabilities, "graduationWorkflows");
  // ... handler logic
})
```

`fetchCapabilitySet` runs a lightweight query returning only the `capabilities` JSONB column from the institution profile row. It is tenant-scoped and throws if the profile is missing.

### 2. assertCapability

Introduce `assertCapability(capabilities: InstitutionCapabilitySet, key: keyof InstitutionCapabilitySet)` in `src/modules/academy-auth/policy.ts`.

- If the capability is `true`, execution continues normally.
- If the capability is `false`, throw `CapabilityDisabledError` with `{ capability, statusCode: 451 }`.

`CapabilityDisabledError` extends `Error` and carries the capability name and HTTP status 451 so `handleApi` can map it to a structured response.

### 3. HTTP 451 for Disabled Capabilities

API routes for disabled capabilities return HTTP 451 with:

```json
{ "available": false, "capability": "graduationWorkflows", "reason": "Not enabled for this institution." }
```

HTTP 451 was originally defined for "Unavailable For Legal Reasons" (RFC 7725) but is semantically the closest standard code for "this resource exists but is unavailable due to a configuration constraint on this server." It is developer-legible and distinct from 403 (permission denied) and 404 (not found).

`handleApi` in `src/app/api/academy/api-utils.ts` will catch `CapabilityDisabledError` and return 451.

### 4. Ghost Mode UX

When a capability is disabled:

- **API routes** return 451 as described above. Clients that call these routes will receive a structured, interpretable error.
- **Admin pages** guarded by a capability check render a `CapabilityGhostPage` component instead of the feature UI. The ghost page names the disabled capability, names the institution model, and links to `/admin/settings/institution`.
- **Student PWA navigation** hides items backed by disabled capabilities. Students never see a locked door; the nav item simply does not appear.

Ghost Mode Phase 1 (this ADR): API enforcement + `CapabilityGhostPage` component shell.
Ghost Mode Phase 2 (fast follow): Student PWA nav capability-aware hiding; deep link from Institution settings tile into each capability.

### 5. Enforcement Map

| Capability | Enforcement point |
|---|---|
| `studentPwa` | `assertStudentPortalAccess` extended to check capability |
| `guardianPortal` | Guardian API routes |
| `facultyPortal` | Faculty API routes |
| `registrarWorkflows` | Registrar-specific API routes |
| `admissionsWorkflows` | Admissions API routes |
| `transcriptWorkflows` | Transcript API routes |
| `graduationWorkflows` | Graduation API routes |
| `lmsLaunch` | LMS launch route + student LMS endpoint |
| `lmsRosterSync` | LMS roster sync routes |
| `lmsGradeReturn` | LMS grade return routes |
| `shepherdAiRecommendations` | ShepherdAI API routes |

### 6. What Is Not Changed

- Role-based access control in `academy-auth/policy.ts` is unchanged. Capabilities are a second gate, not a replacement.
- Tenant isolation logic is unchanged.
- The `InstitutionCapabilitySet` type and the mode-pack derivation logic are unchanged.
- Migrations are not required; the capability data already exists in the `institution_profiles` table.

## Consequences

**Positive:**
- The institution mode and mode-pack configuration model has real runtime effect.
- Multi-tenant capability isolation is enforced at the API layer, not just the UI layer.
- Admins receive clear feedback (Ghost Mode) when a capability is disabled rather than cryptic errors.
- Adding a new capability gate is one line: `assertCapability(capabilities, "newCapability")`.

**Negative:**
- All capability-guarded routes must be identified and updated. Missed routes leave gaps until found.
- `withCapabilityContext` adds one DB query per request for routes that adopt it. This is a single-row key lookup on a JSONB column; performance impact is negligible.
- Existing API clients that call now-gated routes will receive 451 instead of a response. The demo tenant has all capabilities on, so no demo breakage is expected.

## Alternatives Rejected

**Scattered per-route flag checks:** Adding `if (!capabilities.lmsLaunch)` in each route handler individually creates inconsistency and is hard to audit. Rejected in favor of the centralized `withCapabilityContext` pattern.

**Middleware-layer enforcement:** A Next.js middleware approach was considered but rejected because capabilities require a DB read (the institution profile), and middleware runs before the DB context is established. Route-layer enforcement is simpler and consistent with the existing pattern.

**No enforcement (status quo):** The capability flags are design infrastructure for the multi-mode model. Leaving them as display values indefinitely erodes the product's core positioning. Rejected.

## Related

- ADR 0002: Institution type and operating rules model
- ADR 0060: Concrete institution modes and mode packs
- Council Review III: `docs/reviews/council-review-3-capability-enforcement.md`
