# ADR-0032 — UUID/Text Schema Consistency

**Status:** Accepted  
**Date:** 2026-06-18  
**Deciders:** Ricardo Julia

## Context

The schema uses `text` as the primary-key type across all normalized tables:
`academy_people.id`, `academy_course_sections.id`, `academy_staff.id`, etc.

Two tables were created with `uuid` foreign-key columns that reference these `text` PKs:

| Table | Column | Type | References |
|---|---|---|---|
| `academy_attendance_records` | `course_section_id` | `uuid` | `academy_course_sections.id` (text) |
| `academy_attendance_records` | `student_person_id` | `uuid` | `academy_people.id` (text) |
| `academy_transcript_issuances` | `student_person_id` | `uuid` | `academy_people.id` (text) |
| `academy_transcript_issuances` | `issued_by_person_id` | `uuid` | `academy_people.id` (text) |

Postgres does not implicitly cast between `uuid` and `text`. Any query that joins or filters on these columns using text ID values will fail. Seed data cannot be inserted because the demo IDs (e.g., `"student-naomi-price"`) are not valid UUIDs.

## Decision

**Correct the `uuid` columns to `text` to match the rest of the schema.**

Rationale:
- The entire schema uses human-readable `text` IDs. Switching attendance/transcript tables to `text` restores consistency.
- Changing PKs to `uuid` would require a coordinated migration of every table and every client query — a much larger blast radius with no incremental benefit.
- Human-readable IDs aid debugging and seed data readability, which are intentional design choices in this codebase.

## Migration Pattern

The correction migration must:
1. Drop the FK constraint (if any) on the affected columns.
2. `ALTER TABLE ... ALTER COLUMN ... TYPE text USING ...::text` — no data loss since the columns are empty in production (blocked since creation).
3. Re-add FK constraint as `REFERENCES academy_people(id)` (text-to-text).

One migration per affected table.

## Consequences

- **Positive:** Unblocks `academy_attendance_records` and `academy_transcript_issuances` for seed data and production queries.
- **Positive:** Unblocks attendance module and transcript issuance write workflow implementation.
- **Neutral:** No client-query changes required — callers already use text IDs.
- **Negative:** Two more migrations in the append-only chain. Acceptable.

## Related

- ADR-0030: Legacy dataset deprecation
- Council Review VI Agent 1 — identified as #1 critical gap
