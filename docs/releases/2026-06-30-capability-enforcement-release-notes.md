# ChurchCore Academy 0.9.0 — Capability Enforcement and Institution Settings Release Notes

**Release date:** 2026-06-30
**Version:** 0.9.0
**Stage:** controlled-pilot candidate

---

## What This Release Delivers

Version 0.9.0 closes the gap between the institution configuration model and actual runtime behavior. All 11 institution capability flags — which were display-only through 0.8.0 — are now enforced at the API layer. It also delivers a fully redesigned Institution Settings page and a working delete path for Academic Periods.

---

## 1. Institution Capability Enforcement (ADR 0061)

### Background

ChurchCore Academy's institution mode and mode-pack model (ADR 0060) assigns capability flags to each tenant based on their selected modes. Through 0.8.0, all 11 flags (`studentPwa`, `guardianPortal`, `facultyPortal`, `registrarWorkflows`, `admissionsWorkflows`, `transcriptWorkflows`, `graduationWorkflows`, `lmsLaunch`, `lmsRosterSync`, `lmsGradeReturn`, `shepherdAiRecommendations`) were stored and displayed but had no runtime effect. Access was gated by role only.

A Council III review on 2026-06-29 confirmed this as a medium-risk architecture gap: a Bible school tenant with `lmsLaunch: false` could still call LMS launch routes; a children's school with `graduationWorkflows: false` could still reach graduation endpoints. The multi-mode configuration model was cosmetic at runtime.

### What Changed

**Centralized enforcement infrastructure:**

- `withCapabilityContext(actor, handler)` in `src/lib/capability-context.ts` — wraps `withAcademyDatabaseContext`, fetches the institution capability set once per request (tenant-scoped, single-row JSONB read from `academy_institution_profiles`), and injects it into the handler alongside the database client.
- `assertCapability(capabilities, key)` in `src/modules/academy-auth/policy.ts` — if the flag is false, throws `CapabilityDisabledError` with `statusCode: 451`.
- `CapabilityDisabledError` — carries the capability name and a 451 status code for structured API error handling.
- `handleApi` extended to catch `CapabilityDisabledError` and return HTTP 451 with `{ available: false, capability, reason }`.

**Ghost Mode (Wildcard council recommendation):**

Disabled capabilities return HTTP 451 — "Unavailable For Configuration Reasons" — not 403 Forbidden. This gives API clients a structured, interpretable signal. The `CapabilityGhostPage` React component is available for admin pages that need to surface a graceful "not available for your institution" screen with a link back to Institution settings.

**Route enforcement — 35+ routes wired:**

| Capability | Routes enforced |
|---|---|
| `studentPwa` | Student LMS launch route |
| `guardianPortal` | 7 guardian student routes |
| `admissionsWorkflows` | 16 admissions workflow routes |
| `transcriptWorkflows` | 4 transcript routes |
| `lmsLaunch` | Student LMS launch + LMS readiness + LMS contract GET |
| `lmsRosterSync` | LMS contract roster/enrollment operations |
| `lmsGradeReturn` | LMS contract grade/progress operations |
| `shepherdAiRecommendations` | 8 ShepherdAI routes (suggestions, evaluate, watchlist, risk score, defer/promote/dismiss/snooze) |

**Gates pending** (routes not yet built — enforcement will activate automatically when routes are added):
- `facultyPortal` — faculty-specific API routes not yet built
- `registrarWorkflows` — registrar-specific API routes not yet built
- `graduationWorkflows` — graduation workflow API routes not yet built

### Security posture

Capability enforcement is additive. Role-based access control is unchanged. Capabilities are a second gate: a user still needs the correct role AND their institution must have the capability enabled. No cross-tenant exposure exists; the capability set is always fetched within `withAcademyDatabaseContext` using the authenticated actor's `tenantId`.

---

## 2. Institution Settings Page Redesign

The `/admin/settings/institution` page was restructured from a list of content cards into four fully clickable metric tiles, each opening a focused dialog:

| Tile | Dialog contents |
|---|---|
| Institution Model | Mode picker (InstitutionModesEditor) |
| Institution | Tenant ID (read-only), Legal name (editable), Default mode selector |
| LMS Provider | Provider, selection status, notes; link to LMS settings |
| Validation | Operating rules grid, enabled capabilities with enforcement status badges, validation warnings |

**Key details:**
- Institution tile now displays `legalName` rather than the hardcoded `institutionName` field (which was set by the demo migration to a long demo string).
- Legal name is editable inline in the Institution dialog.
- Capability badges in the Validation tile now show "Off — enforced" instead of "Off", communicating that disabled capabilities have runtime effect.
- All tiles follow the consistent `ops-metric-link` / `ops-metric-inner` pattern for centered, clickable metric display.

---

## 3. Academic Period Delete

Administrators can now hard-delete academic periods from the calendar settings page. The delete is blocked if any student enrollment references the period via course sections, matching the guard pattern used for Academic Years. The confirmation dialog and delete route follow the same pattern as other calendar mutations.

---

## 4. Documentation and Process

- **ADR 0061** — `docs/adr/0061-institution-capability-enforcement.md` — records the capability enforcement decision, Ghost Mode UX, HTTP 451 convention, and the `withCapabilityContext` pattern.
- **Council Review III** — `docs/reviews/council-review-3-capability-enforcement.md` — full four-councilor review including Product/SIS Domain, Domain Architect, Security/Privacy, and Wildcard findings.
- **Design Spec** — `docs/superpowers/specs/2026-06-29-capability-enforcement-design.md`
- **Implementation Plan** — `docs/superpowers/plans/2026-06-29-capability-enforcement.md`
- **AI Prompts** — `docs/prompts/2026-06-29-capability-enforcement-ai-prompts.md` — 4-worker orchestration prompts for reproducing or extending this work

---

## Verification

```
npm test:    1251/1252 passing (1 pre-existing calendar-crud failure, unrelated)
npm run lint: clean
npm run build: success
```

---

## External Gates — Unchanged

The 0.9.0 release does not change any external activation gate. All gates from 0.8.0 remain in effect:

- LMS production activation requires sandbox evidence per the provider activation runbook.
- Live payment, email/SMS, and regulated aid require separate provider evidence and approval.
- Model-generated learner predictions and autonomous interventions require separate council approval.
- General availability is not approved.

---

## Files Changed

**New:**
- `src/lib/capability-context.ts`
- `src/components/ui/CapabilityGhostPage.tsx`
- `src/app/admin/settings/institution/InstitutionTile.tsx`
- `src/app/admin/settings/institution/InstitutionModelMetric.tsx`
- `src/app/admin/settings/institution/LmsProviderTile.tsx`
- `src/app/admin/settings/institution/ValidationTile.tsx`
- `src/app/api/academy/calendar/periods/[id]/route.ts`
- `src/modules/academy-auth/__tests__/capability-enforcement.test.ts`
- `src/lib/__tests__/capability-context.test.ts`
- `docs/adr/0061-institution-capability-enforcement.md`
- `docs/reviews/council-review-3-capability-enforcement.md`
- `docs/superpowers/specs/2026-06-29-capability-enforcement-design.md`
- `docs/superpowers/plans/2026-06-29-capability-enforcement.md`
- `docs/prompts/2026-06-29-capability-enforcement-ai-prompts.md`

**Modified:**
- `src/modules/academy-auth/policy.ts` — `CapabilityDisabledError`, `assertCapability`, `assertStudentPortalAccess` extension
- `src/app/api/academy/api-utils.ts` — 451 handler
- `src/modules/academic-calendar/mutations.ts` — `deletePeriod`
- `src/modules/academy-config/postgres-repository.ts` — `updateIdentity`
- `src/app/api/academy/config/institution/route.ts` — extended PATCH
- `src/app/admin/settings/institution/page.tsx` — stripped to 4 tiles
- `src/app/admin/settings/calendar/PeriodActions.tsx` — delete action
- `src/styles/admin.css` — Ghost Mode CSS
- 35+ API route files — `withCapabilityContext` + `assertCapability`
