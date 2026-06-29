# ADR-0050: Academic Period Lifecycle and Term-Lock Policy

**Date:** 2026-06-26
**Status:** Accepted
**Deciders:** Ricardo Julia (via Council Review)

---

## Context

The Academy's data integrity relies on the principle that academic records become immutable once an academic period is complete. The system has an `AcademicPeriod` entity (per `2026-06-01-academic-calendar-subdivision-design.md`) but lacks a formal lifecycle and enforcement mechanism to "lock" data. Without this, historical records like enrollments, attendance, and grades are at risk of retroactive modification, which undermines transcript accuracy and institutional reporting.

This gap corresponds to item `G-A1` in the `competitive-roadmap.md` and was prioritized by the council to make the Academic Period the foremost unit of measure.

---

## Decision

We will implement a state-driven lifecycle for `AcademicPeriod` records, managed exclusively by a new `AcademicPeriodLifecycleService`. This service will be the sole authority for transitioning a period's status, ensuring that all changes are deliberate, audited, and adhere to strict immutability rules.

### 1. Academic Period State Machine

The `status` of an `AcademicPeriod` will follow a strict, linear progression:

-   **`planned`**: The initial state. All attributes of the period are mutable.
-   **`enrollment_open`**: The period is open for student registration. The period's core dates (`startsOn`, `endsOn`) become immutable.
-   **`active`**: The period is in progress. Instructional activities are occurring. All period attributes and associated course section details become immutable.
-   **`completed`**: The period is finished, and all academic activities (like grading) are finalized. The period and all its child records (enrollments, grades, attendance) are now considered permanent and are locked from any further modification at the application layer.

### 2. Centralized Lifecycle Service

A new `AcademicPeriodLifecycleService` (`src/modules/academic-calendar/period-lifecycle-service.ts`) will be created. It will expose methods for state transitions: `openEnrollment()`, `activatePeriod()`, and `completePeriod()`. Direct database updates to the `status` column will be prohibited by convention and team discipline.

### 3. Immutability Enforcement ("Term-Lock")

Repositories for related entities (e.g., `CourseSectionRegistrationRepository`, `GradebookRecordRepository`) will be updated to check the status of the relevant `AcademicPeriod` before performing any write operation. If the period is `completed`, the operation must be rejected with a `PermanentRecordError`, which will translate to a `409 Conflict` HTTP status.

For a stronger guarantee, we will also implement database-level triggers to prevent `UPDATE` or `DELETE` operations on tables related to a `completed` academic period.

### 4. Audited "Re-Open" Procedure (Wildcard Proviso)

To handle exceptional cases, such as a significant clerical error discovered after a term is completed, a "break-glass" procedure is required.

-   The `AcademicPeriodLifecycleService` will include a `reopenPeriod(periodId, reason)` method.
-   This method transitions a `completed` period back to `active`.
-   **Access to this method is severely restricted.** It is not exposed via a public API route and can only be called by a `platform_admin` through a documented internal runbook or support process.
-   Every call to `reopenPeriod` must provide a non-empty `reason` and will generate a high-severity, immutable audit event detailing who performed the action, when, and why.

---

## Consequences

-   **Data Integrity:** Provides a strong guarantee of historical data integrity, which is essential for transcripts, financial aid, and accreditation.
-   **Operational Clarity:** Creates a clear, predictable workflow for registrars and academic administrators to manage the school year.
-   **Reduced Risk:** Prevents accidental or unauthorized changes to historical records.
-   **Controlled Exceptions:** The audited re-open procedure provides a safe escape hatch for legitimate exceptions without compromising the day-to-day integrity of the system.
-   **Implementation Cost:** Requires creating the new service, updating several repositories to check for the lock status, and adding database triggers. This is a worthwhile investment for the core business logic.

---

## Alternatives Considered

1.  **Application Logic Only:** Relying solely on application-layer checks without database triggers.
    -   *Rejected:* This is brittle. A bug or a direct database change could bypass the lock, violating the core principle.
2.  **No Re-Open Procedure:** Making `completed` a truly irreversible state.
    -   *Rejected:* While ideal in theory, this is too rigid for practical school operations where mistakes happen and require correction. The Wildcard review correctly identified this as a major operational risk.
3.  **Role-Based Field-Level Security:** Making individual fields read-only based on state.
    -   *Rejected:* Overly complex to implement and maintain compared to a simple, clear state machine that locks the entire record and its children.

---

## Related

-   **Council Review (2026-06-26):** The originating council decision that mandated this work.
-   **ADR-0019 (Immutable Audit Events):** The `reopenPeriod` action must generate an audit event according to this pattern.
-   **Design Doc (2026-06-01):** `academic-calendar-subdivision-design.md` which this ADR builds upon.