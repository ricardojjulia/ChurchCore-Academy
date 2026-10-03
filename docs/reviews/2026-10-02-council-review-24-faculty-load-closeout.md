# Council Review 24 - Faculty-Load Accuracy And E2E Closeout

Date: 2026-10-02
Branch: `fix/faculty-load-incomplete-aggregates`
Issue: `#216`
Decision requested: ship / revise / defer / reject

## Executive Verdict

Decision: **ship through protected PR delivery**

The closeout corrects a misleading completeness claim in the faculty-load read
model and replaces superficial browser coverage with a real dependency path.

## Council Findings

### Product And SIS

Known totals remain useful only when every assigned section contributes the
relevant value. Unknown credits, clock hours, or capacity now remain visibly
incomplete instead of becoming a partial total that could influence staffing
judgment.

### Architecture And Data

The existing normalized query and read-only workspace remain intact. Nullable
aggregate fields express completeness without a migration, duplicate write path,
or LMS dependency. ADR-0077 now records the completeness contract.

### Security And Privacy

Authorization and tenant/period query binding are unchanged. The expanded journey
uses existing authenticated Academy APIs and retains the other-tenant denial check.
No grades, notes, compensation, or student identities are added to the workspace.

### UX And Accessibility

Incomplete instruction values use explicit text. Enrollment remains visible as a
known count while an incomplete capacity denominator is omitted and labeled. The
table structure, review flags, and assignment-management handoff remain unchanged.

### Testing Council

Unit coverage now proves fully configured totals, all-missing values, mixed
configured/unconfigured sections, zero sections, no context, and denied access.
The journey uses a seeded actively enrolled student, creates its year, period,
course, section, registration, advisor assignment, and saved context through real
APIs, then asserts credits, hours, seats/capacity, utilization, advisee count, and
cross-tenant denial.

## Residual Risk

Institution load-policy interpretation, assistant instructors, contracts/FTE,
compensation, and schedule collision inference remain deliberately outside scope.

## Decision

The full local gate, disposable-database E2E suite, and local `pr-review` pass.
Proceed through hosted checks and Copilot review. No deployment is authorized.
