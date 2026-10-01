# ADR 0077: Faculty Teaching-Load Intelligence

Date: 2026-10-01
Status: accepted

## Context

Academy stores active staff, faculty-capable roles, course sections, course credit and clock-hour values, section registrations, advising assignments, and a persistent academic-period context. The existing `/admin/faculty` page showed legacy ShepherdAI suggestions but did not provide administrators a normalized, period-scoped view of actual teaching responsibility.

## Decision

Academy will provide `/admin/faculty` as the faculty teaching-load intelligence workspace.

- Institution administrators, deans, and academic administrators may read the workspace.
- The read model includes active staff with active `faculty`, `teacher`, or `professor` role assignments in the actor's tenant.
- Teaching load is scoped to the selected academic period and current primary-instructor assignments.
- Each faculty summary exposes section count, instructional credits, instructional clock hours, enrolled seats, configured capacity and utilization, advisee count, section identifiers, and explicit review flags.
- Review flags identify incomplete or exceptional operational records. They are not faculty rankings, performance evaluations, employment recommendations, or autonomous reassignment decisions.
- Section assignments and staff load-policy records remain the authoritative mutation paths. The workspace is read-only and links administrators to existing section management.
- Existing ShepherdAI faculty-assignment alerts and workflow records remain visible to actors with ShepherdAI read access; the normalized load table supplements rather than replaces them.

## Consequences

- Academic leaders can compare teaching and advising responsibility using normalized Academy records.
- Faculty with no assignments remain visible, preventing a workload report from silently excluding zero-load records.
- Institutions without configured credits, clock hours, capacity, or load policy see explicit zero/unknown evidence rather than invented values.
- Assistant-instructor load, contract/FTE calculations, compensation, schedule-conflict inference, and faculty evaluation remain outside this slice.

## Verification

- Focused tests must prove period and tenant query binding, aggregation, zero-section visibility, empty context behavior, and unrelated-role denial.
- E2E must prove an authorized academic administrator can load the production workspace and reach section assignment management.
- Navigation visibility and the surface manifest must match the route role boundary.
