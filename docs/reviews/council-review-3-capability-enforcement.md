# Council Review III — Institution Capability Enforcement
**Date:** 2026-06-29 | **Trigger:** Audit finding that all 11 institution capabilities are display-only
**Scope:** Wiring `InstitutionCapabilitySet` flags into actual runtime enforcement

---

## Council Participants

| Role | Responsibility |
|------|---------------|
| Product & SIS Domain Councilor | Feature correctness, multi-mode institution fit, faith-based UX |
| Domain Architect | Academy boundary, request context design, module ownership |
| Security & Privacy Reviewer | Auth layering, tenant isolation, student data exposure |
| Wildcard Strategist | Out-of-the-box UX and enforcement model innovation |

---

## Audit Finding (Input)

A systematic codebase audit confirmed:

- All 11 `InstitutionCapabilitySet` flags (`studentPwa`, `guardianPortal`, `facultyPortal`, `registrarWorkflows`, `admissionsWorkflows`, `transcriptWorkflows`, `graduationWorkflows`, `lmsLaunch`, `lmsRosterSync`, `lmsGradeReturn`, `shepherdAiRecommendations`) are **display-only**.
- Runtime access is gated entirely by **role** via `academy-auth/policy.ts`.
- Three flags have soft config-level validation only (`guardianPortal`, `lmsRosterSync`, `lmsGradeReturn`).
- Two flags write provisioning metadata but gate nothing at runtime (`graduationWorkflows`, `lmsLaunch`).
- LMS flags are implicitly enforced by checking `lmsPreference.provider`, not the capability flag itself.

**Impact:** A Bible school tenant with `lmsLaunch: false` and an admin role can currently access LMS launch routes. A children's school with `graduationWorkflows: false` can access graduation routes. The flags serve no enforcement purpose.

---

## Councilor Findings

### Product & SIS Domain Councilor

Capabilities were added to reflect the reality that a children's school and a seminary have fundamentally different feature surfaces. Making them display-only was a reasonable MVP shortcut, but it now creates trust problems:

- The institution settings page says "LMS launch: Off" and "LMS roster sync: Off" — but the LMS routes accept requests from those tenants.
- A guardian portal capability shown as "Enabled" but with no PWA built for guardians creates misleading expectations.
- Bible school mode packs intentionally omit graduate-level features — but those routes still respond.

**Verdict:** Enforce capabilities. The faith-based multi-mode model only has value if modes and their packs actually change what institutions can do.

### Domain Architect

The enforcement model must be simple and centralized. Scattered per-route checks will become inconsistent across 50+ routes. The correct pattern follows what already exists:

- `withAcademyDatabaseContext` — provides DB access per request
- `resolveAcademyActorFromSession` — provides the actor (role + tenant)
- `assertInstitutionConfigAccess` — role gate

Capabilities need an equivalent: `assertCapability(actor, capabilityKey, capabilitySet)` backed by a light `fetchCapabilitySet` that sits inside the existing DB context. The capability set should be fetched once per request, not once per assertion.

**Verdict:** Introduce `withCapabilityContext` as a thin wrapper on top of `withAcademyDatabaseContext`. API routes opt in by calling it instead of the base context.

### Security & Privacy Reviewer

Current state means capability flags have zero security value. They are UI labels. The auth model relies entirely on role. This is acceptable for internal-only tools but is not acceptable for a multi-tenant SIS where:

- One tenant is a Bible school with no LMS
- Another is a seminary with full LMS and graduation workflows
- A third is a children's school with guardian portal and no graduate records

Tenant isolation is enforced. Role checks are enforced. But capability isolation is not, which means the tenant configuration model (which is the product's competitive differentiation) has no runtime effect.

**Risk level:** Medium. No cross-tenant data leaks. But wrong features are accessible within the tenant's own data, which can produce incorrect records (e.g., LMS sync triggered on a no-LMS tenant).

**Verdict:** Enforce capabilities at the API route layer. Do not rely on UI hiding alone.

### Wildcard Strategist — Ghost Mode

**The insight:** Hard-blocking disabled capabilities with 403 errors is jarring in a faith-based school context where admins are often non-technical. A children's school admin clicking a graduation route shouldn't get a generic Forbidden error.

**The proposal: Ghost Mode**

When a capability is disabled for a tenant, any route or page guarded by that capability returns a **Ghost Response** instead of a hard error:

- **API routes** return `{ available: false, capability: "graduationWorkflows", reason: "Not enabled for this institution." }` with HTTP 451 (Unavailable For Legal Reasons — repurposed as "Unavailable For Configuration Reasons").
- **Admin pages** render a tasteful "This feature is not available for your institution model" screen with the capability name, the current institution model, and a link to the Institution settings page to review or change the model.
- **Student PWA** surfaces silently hide nav items backed by disabled capabilities — students never see a locked door.

Ghost Mode makes the multi-mode model **legible** to institution admins without requiring technical knowledge. It turns enforcement into product communication.

---

## Cross-Council Consensus

**Ship the enforcement.** The audit result is clear: the flags must gate runtime behavior. The design must be:

1. **Centralized** — one `assertCapability` function, one `fetchCapabilitySet` query per request
2. **Declarative** — each route declares its required capability, the gate runs automatically
3. **Graceful** — Ghost Mode for admin pages, silent hiding for student PWA
4. **Additive** — does not break role-based auth; capabilities are a second gate layered on top
5. **Tenant-safe** — capability set is always fetched within `withAcademyDatabaseContext`, tenant-scoped

**Defer:** Full Ghost Mode UI for all admin pages can ship in a fast follow. The first implementation needs API enforcement and basic page-level capability checks. Ghost Mode admin screens can be a Phase 2.

**Wildcard adopted:** Ghost Mode is accepted as the UX pattern. HTTP 451 repurposed for disabled capability responses is accepted as a developer-legible signal.

---

## Recommended ADR

**ADR 0061: Institution Capability Enforcement via Capability Context and Ghost Mode**

- Records the decision to enforce `InstitutionCapabilitySet` flags at API route and page level
- Records the `withCapabilityContext` pattern
- Records Ghost Mode as the graceful degradation UX
- Records HTTP 451 as the disabled-capability API response code

---

## Implementation Scope

### Phase 1 — Core Enforcement (This Plan)

| Capability | Enforcement target |
|---|---|
| `studentPwa` | Student PWA middleware / `assertStudentPortalAccess` extension |
| `guardianPortal` | Guardian API routes + guardian PWA shell |
| `facultyPortal` | Faculty admin routes |
| `registrarWorkflows` | Registrar-specific API routes |
| `admissionsWorkflows` | Admissions API routes |
| `transcriptWorkflows` | Transcript API routes |
| `graduationWorkflows` | Graduation API routes |
| `lmsLaunch` | LMS launch route + student LMS endpoint |
| `lmsRosterSync` | LMS roster sync routes |
| `lmsGradeReturn` | LMS grade return routes |
| `shepherdAiRecommendations` | ShepherdAI API routes |

### Phase 2 — Ghost Mode UI (Fast Follow)

- Admin page Ghost Mode screens for each disabled capability
- Student PWA capability-driven nav hiding
- Institution settings "capability not available" deep link

---

## Council Sign-off

- Product & SIS Domain: **Ship** — capability enforcement is table stakes for multi-mode positioning
- Domain Architect: **Ship** — `withCapabilityContext` is the right centralized pattern
- Security & Privacy: **Ship** — medium risk closed by enforcing at API layer
- Wildcard: **Ship with Ghost Mode** — UX quality requires graceful degradation, not hard blocks
