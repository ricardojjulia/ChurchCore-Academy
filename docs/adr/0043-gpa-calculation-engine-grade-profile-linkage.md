# ADR-0043 — GPA Calculation Engine and Grade-to-Profile Linkage

**Status:** Accepted
**Date:** 2026-06-22
**Deciders:** @ricardojjulia

---

## Context

ADR-0024 established the gradebook system. ADR-0011 established official-record transcript and audit requirements. Grade records flow from faculty entry through the review and posting workflow into `academy_gradebook_records` with `status: 'official'`.

No engine computes GPA from these official records. The `gpa` field on `academy_student_profiles` exists but has no automated update path — it is a free-editable numeric field that finance, admissions, and ShepherdAI signals read but that becomes stale the moment a new grade is posted.

The consequences are concrete:

- Honor roll computation reads a GPA that may not reflect the current term's grades.
- Academic standing decisions (probation, good standing, suspension) read stale data.
- ShepherdAI workflow signals that trigger on GPA thresholds fire against incorrect values.
- Student transcript PDFs (once generated per ADR-0044) would need to recompute GPA inline at generation time with no canonical source to validate against.
- Staff manually maintaining GPA creates data integrity risk and audit gaps.

GPA rules are institution-specific. A 4.0 scale letter-grade system (A=4, B=3, C=2, D=1, F=0) is the most common but is not universal. Competency-based and narrative-only programs have no numeric GPA. Pass/fail courses may or may not contribute quality points. The calculation engine must read from the institution's grading scale configuration rather than hardcoding any particular scale.

---

## Decision

Add a `computeStudentGpa` function in the `grading` module that computes GPA from official gradebook records using the institution's configured grading scale.

**Function signature:**

```ts
export async function computeStudentGpa(
  tenantId: string,
  studentId: string,
  client: PoolClient
): Promise<{ gpa: number; qualityPoints: number; creditHoursAttempted: number; creditHoursEarned: number } | null>
```

Returns `null` if the student has no official grade records or if the institution's grading scale is not numeric (competency-based or narrative-only).

**Computation algorithm:**

1. Read all `academy_gradebook_records` where `tenant_id = tenantId`, `student_id = studentId`, `status = 'official'`, and the associated course section has `grade_mode != 'narrative_only'`.
2. For each record, look up the grade value in `academy_grading_scales` for the tenant: find the scale entry matching the posted grade symbol, read `quality_points` and whether the course counts toward GPA (`include_in_gpa`).
3. For pass/fail courses (`grade_mode = 'pass_fail'`): a passing grade earns `credit_hours` in `creditHoursEarned` but contributes 0 quality points. A failing grade earns 0 credit hours. Neither affects `qualityPoints` or the GPA numerator.
4. For letter-grade courses: `quality_points_for_course = quality_points_from_scale * credit_hours`. Accumulate across all qualifying records.
5. `gpa = totalQualityPoints / totalCreditHoursAttempted`, rounded to 2 decimal places. If `totalCreditHoursAttempted = 0`, return `null`.

**Grade-to-profile write-back:**

The registrar grade-posting action (existing `POST /api/academy/gradebook/post` route) calls `computeStudentGpa` after the grade record is committed and writes the result to `academy_student_profiles.gpa`. Both writes occur inside the same database transaction. If GPA computation fails, the transaction rolls back — the grade post does not succeed with a stale GPA.

**Canonical source rule:**

`academy_student_profiles.gpa` is always derived from official grade records. It must not be editable as a free field through any staff UI. Admin correction of GPA must go through grade record correction, not direct profile field edit.

**Downstream consumers:**

- Honor roll queries read `academy_student_profiles.gpa` — no GPA recomputation at query time.
- Academic standing evaluation reads the same field.
- ShepherdAI signal evaluation reads the same field.
- Transcript PDF generation reads `academy_student_profiles.gpa` as the cumulative GPA and cross-references the computed value from `computeStudentGpa` for the per-term GPA breakdown.

**Institutions without numeric GPA:**

If `academy_institutions.grading_type = 'competency'` or `'narrative'`, `computeStudentGpa` returns `null`. Grade-posting for these institutions does not write to `academy_student_profiles.gpa`. The profile field is left null and downstream consumers must handle null GPA gracefully (honor roll and academic standing are not applicable; ShepherdAI signals for these institutions use competency-completion signals instead).

---

## Consequences

**Positive:**
- GPA is always accurate immediately after grade posting — no manual maintenance required.
- Honor roll, academic standing, and ShepherdAI signals read a value that reflects the current official record.
- The transaction boundary means a grade post and GPA update are atomic — partial state is not possible.
- Competency and narrative institutions are handled correctly without a hardcoded numeric assumption.

**Negative:**
- Every grade post now includes a GPA recomputation query over all official records for the student. For students with long academic histories, this query will grow in cost over time. An index on `(tenant_id, student_id, status)` in `academy_gradebook_records` is required.
- The transaction boundary means a GPA computation failure rolls back a grade post. This is the correct behavior, but it means a misconfigured grading scale can block grade posting. Grading scale completeness must be validated at setup time.

---

## Alternatives Considered

### Compute GPA on-demand at every read (no stored GPA)

Rejected. Honor roll queries, ShepherdAI evaluation, and academic standing checks would each trigger a full scan over all official grade records for every student in the tenant. This is not acceptable at production scale.

### Store GPA as a free-editable field and allow staff corrections

Rejected. Free-edit GPA fields create audit gaps, allow accidental or intentional manipulation, and diverge from the official record. Every GPA value must be traceable to its source grade records.

### Batch GPA recomputation job (nightly cron)

Rejected. A nightly batch means GPA is stale for up to 24 hours after grade posting. Honor roll computation run immediately after a grade posting event would read the wrong value. The transactional write-back at grade-post time is the correct model.

### Hard-code a 4.0 scale

Rejected. ChurchCore Academy explicitly supports institution-type configuration (Bible schools, seminaries, K-12, universities). Grading scales differ. The CLAUDE.md architecture rule requires configurable academic structures rather than hardcoded college-only assumptions.

---

## Review Notes

- **Security/privacy:** GPA is a student record. All queries must include `tenant_id`. GPA is never returned to guardian-role users except through the explicitly scoped guardian access model (ADR-0009).
- **Testing:** Tests must cover: standard letter-grade GPA computation, pass/fail course excluded from quality points, course with `include_in_gpa = false` excluded from denominator, no official records returns null, narrative institution returns null, GPA rounded to 2 decimal places, cross-tenant rejection.
- **Index requirement:** `create index on academy_gradebook_records (tenant_id, student_id, status)` is a required migration alongside the function.
- **ShepherdAI boundary:** ShepherdAI reads GPA from the profile field. It does not call `computeStudentGpa` directly. The signal engine must remain decoupled from grading computation.

---

## Related

- ADR-0024 — Gradebook System
- ADR-0010 — Evaluation Type and Grading Rule Model
- ADR-0011 — Official Record, Transcript, and Audit Model
- ADR-0034 — Transcript Request Issuance Workflow
- ADR-0031 — Workflow Evaluator Invocation Pattern
