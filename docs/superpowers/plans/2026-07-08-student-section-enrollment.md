# Student Section Enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff register a student with an active program membership into a real course section from the student detail page.

**Architecture:** Add a narrow staff enrollment service around `academy_course_section_registrations`. It reuses an existing period registration when present and creates one from the student's active program membership when missing. Student self-registration remains unchanged.

**Tech Stack:** Next.js App Router, request-scoped Postgres client, Node test runner, existing Radix/Tailwind UI primitives.

---

## Scope

- Staff can add one course section registration for a student profile.
- The student must already have an active program membership.
- Duplicate active registration for the same section is idempotent.
- Section capacity and section status are enforced.
- No LMS roster sync, grade/progress calculation, or transcript entry creation in this slice.

## Tasks

- [ ] Add tests for staff section assignment, period registration creation, and student page source wiring.
- [ ] Add `student-section-enrollments` service and repository.
- [ ] Add `/api/academy/students/[id]/section-enrollments`.
- [ ] Add student detail section registration dialog.
- [ ] Verify with focused tests, full tests, lint, build, migration rehearsal, and browser smoke.
