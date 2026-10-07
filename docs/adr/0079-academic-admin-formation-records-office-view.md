# ADR-0079 — Academic Admin Gets the Registrar's Formation View

**Date:** 2026-10-06
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Amends:** ADR-0045 (access matrix), ADR-0071 (academic_admin scoping)

---

## Context

`academic_admin` has been on the ministry formation viewer list since PR #105. ADR-0071 decided it should not get the reviewer bypass, and the implementation went further by rejecting it outright. `listStudentsWithFormationSummary` and `getStudentFormationRecord` had no ADR-0045 scope rule for the role, so every request failed with "Forbidden formation record access."

The 2026-10-06 pilot dry run (`docs/reports/pilot-dry-run-2026-10-06.md`) surfaced this as a dead link: academic admins were shown Ministry Formation in the nav and then denied. The owner was asked whether academic admins should see formation records, and at what scope.

## Decision

`academic_admin` gets the registrar's records-office view from ADR-0045's matrix:

| Actor | Formation records | Practicum logs | Evaluations | Pastoral notes |
| --- | --- | --- | --- | --- |
| Academic admin | endorsed, full tenant | endorsed only | endorsed only | never |

- Drafts are hidden, the same as for the registrar.
- Pastoral notes stay hidden. ADR-0071's rule is unchanged: only `institution_admin`, `ministry_formation_reviewer`, or the evaluation's own evaluator see them.
- An academic admin who is also granted `ministry_formation_reviewer` keeps full reviewer visibility. The endorsed-only cap never narrows reviewer access, matching the existing institution_admin + registrar rule.
- ADR-0071's decision that academic_admin gets no implicit reviewer bypass still holds.

## Consequences

- The ministry formation link appears for academic admins. `ADMIN_PAGE_ROLES["/admin/formation"]` in `src/lib/admin-route-access.ts` uses the full viewer list.
- `hasEndorsedOnlyAccess()` in `src/modules/ministry-formation/service.ts` is the single check for the records-office view, shared by the list and the per-student record.
- Tests in `src/modules/ministry-formation/__tests__/service.access-scoping.test.ts` cover:
  - endorsed records visible, drafts hidden
  - pastoral notes absent (`doesNotMatch`)
  - tenant-wide scope
  - cross-tenant rejection
  - reviewer access not narrowed
- Rollback: restore the academic_admin rejection branch and remove the role from the formation viewer list. No schema change is involved.
