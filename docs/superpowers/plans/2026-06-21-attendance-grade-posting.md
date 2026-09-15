# Attendance And Production Grade Posting Execution Plan

Date: 2026-06-21
Program: ADR-0033 Full SIS Competitive MVP
Slice: 2

## Goal

Deliver production-ready daily academic operations for attendance capture and registrar-controlled grade posting.

## Tasks

1. Discovery
   - Inspect attendance API, repository, schema, faculty UI, and admin attendance summary.
   - Inspect gradebook repository, faculty grade workflows, admin gradebook page, and gradebook schema.

2. Red Tests
   - Add attendance service tests for role access, section ownership, and active registration.
   - Add grade posting action tests for registrar posting and faculty rejection.
   - Add student gradebook release-filtering tests.
   - Add migration tests for posting state and immutable posting audit.

3. Attendance Implementation
   - Add `AttendanceService`.
   - Add repository checks for assigned section and active registration.
   - Route attendance POST through the service.
   - Guard attendance GET for student self-access and staff section reads.

4. Grade Posting Implementation
   - Add posting schema and `postGradeAction`.
   - Add append-only grade posting migration.
   - Filter student gradebook reads to posted/released records.
   - Add Admin Gradebook posting queue.

5. Documentation
   - Add design spec.
   - Add operations runbook.
   - Update factory roadmap.

6. Verification
   - Focused attendance and gradebook tests.
   - Full `npm test`.
   - `npm run lint`.
   - `npm run build`.
   - Runtime route smoke where possible.

## Review Notes

- Faculty grading remains draft until registrar posting.
- Posting writes immutable evidence separate from override audit.
- Student-visible grade reads are release-gated.
- LMS grade return remains reviewed-import only and does not post official grades.
