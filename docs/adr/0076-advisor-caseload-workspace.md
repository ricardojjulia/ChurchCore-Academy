# ADR 0076: Advisor Caseload Workspace

Date: 2026-09-30
Status: accepted

## Context

Academy already assigns an academic advisor through `academy_student_profiles.advisor_person_id`, stores advisor notes and holds, and computes explainable retention-risk evidence. The existing advisor directory is an administrative people view; it does not give an advisor a usable, assignment-scoped workflow. ADR-0062 remains proposed and covers a wider people-maintenance design, so this decision must not implicitly accept that broader proposal.

## Decision

Academy will provide `/admin/advising` as the academic advising workspace.

- Advisors see only students whose current student profile names their verified actor person ID as advisor.
- Institution administrators, deans, academic administrators, and registrars may select an active advisor-capable person and inspect that caseload.
- Advisor eligibility is derived from active `advisor`, `faculty`, `professor`, `dean`, or `academic_admin` role assignments in the same tenant.
- The read model exposes summary evidence only: enrollment and program, GPA, latest risk tier and score, unresolved-hold count, open-signal count, and latest advising-note date.
- Existing student records, ShepherdAI signals, and advisor-note services remain the mutation and detailed-record systems of record.
- An advisor is linked to the existing assignment-scoped signal workflow. Oversight roles may follow the existing protected student-record route.

Authorization is enforced before caseload access and in the tenant-scoped query. A requested advisor must be active and advisor-capable in the actor's institution. An advisor cannot select another advisor.

## Consequences

- Advisors receive a practical queue without gaining institution-wide student access.
- Oversight staff can compare and inspect caseloads from the same surface.
- Explainable Academy evidence is reused without introducing autonomous advice or a second intervention system.
- Faculty teaching-load intelligence remains a separate decision and implementation slice.
- Advisor assignment history, bulk reassignment, appointment scheduling, and messaging are outside this slice.

## Verification

- Unit coverage must prove self-scope, oversight selection, unknown/cross-tenant rejection, and unrelated-role rejection.
- E2E coverage must prove the seeded advisor's assigned learner and registrar oversight flow through the production page.
- The page must remain registered in the surface manifest.
