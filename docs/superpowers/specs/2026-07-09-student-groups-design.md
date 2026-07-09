# Student Groups / Cohorts Design

Date: 2026-07-09

## Objective

Complete the Core Academic Loop with tenant-scoped student groups that academic administrators can create, maintain, and populate without losing membership history.

## Model

`academy_student_groups` is the academic grouping record. It is separate from `academy_institution_subdivisions`: subdivisions describe durable organizational hierarchy, while student groups describe dated collections of students.

Each group has:

- a type: `cohort`, `graduating_class`, or `program_cohort`;
- a required Academic Year;
- an optional Academic Program;
- a name, code, description, and `active` or `archived` status.

`program_cohort` requires a program. Other types may optionally identify one. Codes are unique per tenant and memberships are dated. A student may belong to multiple groups, but only one active membership can exist for the same student and group.

## Workflows

- The Academics navigation exposes Student Groups.
- `/admin/groups` lists groups and supports create, edit, archive, and activate.
- Selecting a group exposes its roster and supports adding or removing students.
- The student Academic Record shows current and historical group memberships.
- Archiving a group preserves its roster and prevents new memberships.

## Authorization And Isolation

Institution administrators, registrars, academic administrators, and deans may read and mutate groups. Repository calls always include the actor tenant, database context sets the tenant session variable, and RLS enforces tenant isolation.

## Error Handling

The service validates required text, group type, status, and program requirements. The repository verifies referenced years, programs, students, and active group state. Database uniqueness constraints remain the final concurrency guard.

## Verification

Focused tests cover migration constraints, service authorization and validation, repository behavior, API context, navigation, and UI exposure. Completion also requires the full test suite, lint, production build, migration/seed rehearsal, diff check, and a real-browser create/roster/archive smoke test.

