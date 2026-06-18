# ADR-0026 — Faculty Operational Portal Model

**Date:** 2026-06-18
**Status:** Accepted
**Authors:** Council Review III (Agents 2 & 4 consensus)

---

## Context

The Council III audit found that two faculty nav links point to missing pages:
- `/faculty/sections` — nav item defined in faculty shell; no `page.tsx` exists
- `/faculty/roster` — nav item defined in faculty shell; no `page.tsx` exists

More critically, Agent 4 assessed faculty/professor coverage at **35%** — the lowest of any user type. The faculty gradebook exists but requires an admin path to reach. Faculty cannot today:
- View their own assigned sections in a dedicated faculty-scoped view
- View a per-section roster of their enrolled students
- Take attendance from their own portal (only admin-scoped attendance exists)
- See their own teaching schedule from a faculty-specific perspective

This is a blocking gap. No school can adopt the system if teachers cannot manage their own courses, sections, and grading without relying on admin access.

---

## Decision

The faculty portal (`/faculty/*`) must be a complete operational workspace for all faculty roles (`faculty`, `teacher`, `professor`). The admin portal (`/admin/*`) remains the institutional management surface. These must not be the same views.

**Faculty portal scope (this ADR):**

| Route | Purpose | Data Source |
|-------|---------|-------------|
| `/faculty` | Dashboard — today's schedule, pending grades, ShepherdAI signals | `loadProtectedAcademyDataset()` filtered to actor |
| `/faculty/sections` | My Sections — list of sections where actor is assigned instructor | `academy_course_sections` where `instructor_person_id = actor.userId` |
| `/faculty/roster` | Per-section roster — enrolled students for a given section | `academy_registrations` where `section_id = :sectionId` joined with `academy_people` |
| `/faculty/attendance` | Attendance entry — submit attendance for a section+date | `academy_attendance_records` POST via existing API |
| `/faculty/gradebook` | Grade entry — submit and review grades per section | existing gradebook system |
| `/faculty/shepherd` | ShepherdAI signals — filtered to faculty-relevant workflows | `runAcademicWorkflowEvaluationJob()` filtered by actor |

**Tenant isolation rule:** Every faculty page must filter by `actor.tenantId` AND by the actor's own section assignments. Faculty must not see sections they are not assigned to, even within the same tenant.

**Role enforcement:** Faculty pages must verify the actor has role `faculty | teacher | professor` (or `institution_admin | dean` for admin override). Any other role returns a 403 redirect to their appropriate dashboard.

**Read-only vs. write:** Faculty can write attendance and grades for their own sections. They cannot modify course catalog entries, student enrollment status, or academic standing. Those actions require registrar or admin role.

---

## Consequences

**Positive:**
- Teachers have a self-contained workspace without requiring admin access
- Tenant isolation is enforced at the faculty scope, not just tenant scope
- Adds sections and roster as first-class faculty views

**Negative:**
- Some data (section roster, enrollment status) is already available in admin views; faculty views are intentionally narrower and require separate page implementations
- Faculty and admin grade entry share the same gradebook module but must render through role-appropriate shells

---

## Implementation Notes

- `/faculty/sections` queries `academy_course_sections` where `instructor_person_id::text = actor.userId`
- `/faculty/roster/[sectionId]` queries `academy_registrations` joined with `academy_people` where `section_id = $1 AND tenant_id = $2`; verifies requesting actor is the section's instructor before returning data
- Both pages use `loadProtectedAcademyDataset()` for actor resolution, then `withAcademyDatabaseContext` for the section-scoped queries
- Empty state for `/faculty/sections`: "No sections assigned to you this term. Contact your registrar."

---

## Related ADRs

- ADR-0008: People role assignment and permission model
- ADR-0018: Postgres RLS and request database context
- ADR-0024: Gradebook system
