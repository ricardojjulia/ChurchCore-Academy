# ADR-0071 — Ministry Formation Reviewer Role, Access Scoping, and Institution Capability Gating

**Date:** 2026-09-14
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)

---

## Context

ADR-0045 defined the ministry-formation domain's privacy model, including an access matrix (section 4) that specifies a dedicated `ministry_formation_reviewer` permission, section-scoped faculty visibility, advisee-scoped advisor visibility, and a registrar cap that excludes pastoral notes. When the ministry-formation admin UI shipped (PR #105), the implementation used a flat `formationViewerRoles` set (`faculty`, `advisor`, `institution_admin`, `registrar`, `academic_admin`) granting identical tenant-wide access, including pastoral notes, to every member of every one of those roles. Council Review 16 (`docs/reviews/2026-09-14-council-review-16-ministry-formation-admin-ui.md`) caught the resulting privacy gap on the student-facing side (draft records reaching students) but did not catch that the staff-facing access model itself never matched ADR-0045's matrix at all.

Separately, ADR-0061 defined the `InstitutionCapabilitySet` enforcement pattern but ministry-formation had no capability flag — every tenant, regardless of institution type, could reach the admin and student formation UI.

This ADR records how both gaps were closed, and the two judgment calls made in doing so, since ADR-0045 did not anticipate either the formation-advisor concept or the absence of a permission-catalog system in this codebase.

---

## Decision

### 1. `ministry_formation_reviewer` is a role value, not a separate permission

A codebase-wide investigation (2026-09-14) confirmed this codebase has no permission-catalog system, claims model, or any access-control primitive finer-grained than `AcademyRole` membership anywhere. Building a general permission system was out of scope for closing this specific gap. `ministry_formation_reviewer` is therefore added as a new `AcademyRole` value in `src/modules/academy-auth/policy.ts`, consistent with how every other access grant in this codebase already works.

There is also no role-assignment UI anywhere in this codebase for any role — roles are displayed read-only on the staff detail page. Rather than building a generic role editor, a minimal, ministry-formation-scoped grant/revoke control was added to the existing staff detail page (`src/app/admin/people/staff/[id]/page.tsx`), backed by two new service functions (`grantMinistryFormationReviewer`, `revokeMinistryFormationReviewer`) and API routes, writing to the existing `academy_person_role_assignments` table. This is intentionally narrow — it is not a precedent for a general role-assignment system, and should not be copied for other roles without a separate decision.

### 2. `institution_admin` bypasses the reviewer requirement

ADR-0045's matrix does not name `institution_admin` at all. The investigation found no "break glass" pattern anywhere in this codebase where `institution_admin` must hold an additional explicit permission to access sensitive data — `institution_admin` implicitly bypasses every other role gate in every other module. Requiring `institution_admin` to separately hold `ministry_formation_reviewer` would have been inconsistent with that established pattern and would have risked locking administrators out of their own tenant's data until someone remembered to grant it. `institution_admin` therefore gets full reviewer-equivalent access (including pastoral notes) without needing the explicit role.

`academic_admin` is NOT given this bypass — it is not `institution_admin`, ADR-0045's matrix doesn't name it either, and treating every admin-adjacent role as an implicit bypass would have defeated the point of adding the explicit permission at all. `academic_admin` needs `ministry_formation_reviewer` explicitly granted, same as `faculty`, `advisor`, or `registrar` would if they needed elevated access.

### 3. Advisee-scoping uses the formation-advisor relationship, not the academic advisor

ADR-0045's "Advisor (advisee)" row predates the formation-advisor concept this feature introduced (`ministry_formation_advisor_assignments`, a one-to-one relationship distinct from `StudentProfile.advisorPersonId`). For formation-record advisee-scoping specifically, the `advisor`-role actor's visible-student-set is now defined by the formation-advisor relationship, not the academic-advisor relationship. Rationale: a student's academic advisor may have no involvement in their spiritual formation, and the formation-advisor relationship is the more precise, domain-specific signal. This is an interpretation of an ADR clause that didn't anticipate the concept it now governs, not a contradiction of the original decision.

### 4. Faculty and registrar scoping matches ADR-0045's matrix as originally written

- Faculty: scoped to students registered in the faculty member's own course sections (`academy_course_sections.instructor_person_id`), per the existing pattern in ADR-0026.
- Registrar: sees practicum totals and released/endorsed-only records tenant-wide, but never pastoral notes — even if a registrar were separately granted `ministry_formation_reviewer`, the registrar cap on pastoral notes still applies. Registrar is the one role ADR-0045 explicitly caps regardless of elevated access, and that cap is preserved.

### 5. Pastoral notes visibility

An evaluation's `pastoralNotes` field is now visible only to: an actor with `institution_admin` role, an actor with `ministry_formation_reviewer` role, or the evaluation's own evaluator (`evaluation.evaluatorPersonId === actor.userId`), matching ADR-0045's "Faculty (section): pastoral notes = own only" clause generalized to any evaluator, not just faculty. Every other staff actor — including faculty who didn't write that specific evaluation, an advisor, a registrar, or an `academic_admin` without the reviewer role — receives the evaluation without the `pastoralNotes` field, the same way students already did before this change.

### 6. `ministryFormation` institution capability

Added to `InstitutionCapabilitySet` (`src/modules/academy-config/types.ts`), following the exact `graduationWorkflows` pattern from ADR-0061: `false` by default, overridden to `true` for `bible_school`, `seminary`, `college`, and `university` mode packs, left at the base default (`false`) for `childrens_school`. Enforced via `assertCapability`/`withCapabilityContext` on every ministry-formation API route and page. Disabled-capability admin pages render `CapabilityGhostPage` — this is the first real usage of that component anywhere in the app (it existed as an unused shell since ADR-0061). Disabled-capability nav-hiding for the Student PWA is also a first-of-its-kind implementation in this codebase (ADR-0061 deferred nav-hiding as "Phase 2 fast follow" and no capability had it built yet); it is scoped narrowly to the `ministryFormation` flag and the single "Formation" nav destination via a small React Context populated once in `src/app/student/layout.tsx` — it is not a general capability-aware navigation system, and extending it to the other 11 capabilities is a separate decision.

---

## Consequences

- Pastoral-notes exposure is now scoped to the people ADR-0045 actually intended: reviewers, admins, and the evaluator who wrote the note — not every staff member holding any formation-viewer role.
- Granting `ministry_formation_reviewer` is a real administrative action (institution_admin-only, tenant-isolated, auditable via `academy_person_role_assignments`), not a role every admin-adjacent user gets by default.
- A tenant without ministry-formation relevance (e.g. a children's school) no longer sees any trace of the feature — no nav entry, no reachable pages, no API surface.
- The minimal reviewer-grant control on the staff detail page is explicitly out of scope as a precedent for a general role-assignment UI. If a future feature needs the same shape again, that's a signal a real role-assignment system is overdue — not a reason to keep copy-pasting this pattern.

---

## Related

- ADR-0045 — Ministry Formation Records Model and Privacy Boundary (the access matrix this ADR implements)
- ADR-0061 — Institution Capability Enforcement (the capability-gating pattern this ADR extends to a new flag)
- ADR-0026 — Faculty Operational Portal Model (the section-scoping query pattern reused here)
- `docs/reviews/2026-09-14-council-review-16-ministry-formation-admin-ui.md` — the review that surfaced the original student-facing privacy gap and prompted this deeper audit of the staff-facing access model
