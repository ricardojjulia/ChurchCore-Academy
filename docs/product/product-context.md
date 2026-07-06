# ChurchCore Academy — Product Context

**Read this before writing any code, designing any feature, or producing any plan.**
This document gives you the product judgment you need to make good decisions.
Architecture rules are in `CLAUDE.md`. This document tells you *what we are building and why*.

---

## What ChurchCore Academy Is

ChurchCore Academy is a **faith-based Student Information System (SIS)** — a system of record for the administrative and academic lifecycle of a learner at a faith-based institution.

Target institutions range from children's Bible programs and K-12 Christian schools through Bible colleges, seminaries, and faith-based universities. The system must support all of them through configuration, not hardcoded assumptions.

A SIS is not an LMS. ChurchCore Academy does not deliver courses. It records, tracks, and governs the academic and administrative facts that surround the learner: who they are, what program they are in, which term they are enrolled in, which courses they have completed, what progress they have made, and what their official transcript says. The LMS (Moodle, Canvas, or another provider) delivers instruction. ChurchCore Academy is the system of record that the LMS consumes.

---

## The Canonical Data Model

Every major SIS — Banner, PeopleSoft, PowerSchool, Infinite Campus, Ed-Fi — is built on the same underlying pattern: a **hub-and-association model** where stable master entities sit at the hub and time-bounded transactional associations connect them.

ChurchCore Academy follows this same pattern. The canonical entity graph is:

```
Institution (Organization)
  └── Academic Year
        └── Academic Period (Term / Session)
              └── Course Section
                    └── Enrollment (Student ↔ Section)
                          └── Grade / Assessment Result

Program (versioned per Academic Year of entry)
  └── Required Courses (the program library for that year)
  └── Student Program Membership (dated — student follows entry-year requirements)

Student
  └── Person Record (identity, contact, demographics)
  └── Student Profile (enrollment status, student number, program, advisor)
  └── Student Group Membership (cohort or class group)
  └── Enrollments → Sections
  └── Progress toward Program completion
  └── Transcript Entries (official snapshots — not recomputed joins)

Covenant Record (faith-specific — opt-in per institution)
  └── Spiritual journey fields per person
```

**Student group membership** means a cohort — a named group of students who entered the same program at the same time and move through it together. A cohort is scoped to a Program + Academic Year of entry. Cohorts power the "next courses" guidance: the system knows where in the curriculum sequence a cohort currently sits and can recommend the next courses accordingly.

**The write path is normalized. The read path is denormalized.**
Operational mutations always target the normalized core. Student-facing views, LMS roster feeds, progress dashboards, and transcript outputs are projections from that core — never the authoritative write target.

---

## The Core Academic Loop

This is the sequence of operations that must work completely before anything else matters. Every screen, every feature, every API that is not part of this loop is secondary.

```
1. Create Academic Year
2. Add Academic Periods to that Year (Fall, Spring, Summer, etc.)
3. Create Courses in the Course Catalog
4. Create a Program with a Required Course List for this Academic Year (the Program Library)
5. Create Course Sections within a Period (offering a Course in a specific Period)
6. Assign an Instructor to a Section
7. Enroll a Student in a Program (Student Program Membership — dated to entry year)
8. Enroll a Student in Sections within the active Period
9. Track Student progress: which required courses are complete, which remain
10. Record a Grade for an Enrollment
11. Produce a Transcript Entry (official snapshot — preserved even if program later changes)
```

If an admin cannot complete steps 1–10 end-to-end in the browser, the system does not work. A passing build does not mean the system works.

---

## The Context Picker (The Most Critical Missing Piece)

Every administrative screen must be scoped to an **Academic Year** and optionally an **Academic Period**. Without this, a registrar looking at student data has no way to know which year or term they are working in.

The context picker is a persistent selector — visible in the admin shell or page header — that sets:
- Active Academic Year (required)
- Active Academic Period (optional — defaults to the current active period within the selected year)

When the context is set, all underlying screens (student lists, enrollment views, course sections, program progress) filter to that year and period. This is how every real SIS works: Banner, PeopleSoft, PowerSchool, and Infinite Campus all require a term/session context before showing registration data.

**Persistence:** The selected year and period are saved per user in the database (`academy_user_context` table: `user_id`, `tenant_id`, `active_academic_year_id`, `active_academic_period_id`). The selection survives browser close and persists across devices. On first login with no saved context, the system defaults to the current active academic year and its current active period.

**The context picker must be built before any enrollment or section management UI is built.**

---

## Current Honest State

The following actually works end-to-end (admin can complete the workflow in the browser):

| Feature | Status |
|---------|--------|
| Institution configuration (settings, capabilities, mode packs) | Working |
| Academic Years — create, edit, archive | Working |
| Academic Periods — add/edit/transition/delete within a Year | Working (browser-verified 2026-07-03) |
| Context Picker — persistent year + period selector in admin header | Working (browser-verified 2026-07-03) |
| Course Catalog — create, edit, archive, activate courses | Working (browser-verified 2026-07-03) |
| Program Management — create, edit, archive, detail page | Working (browser-verified 2026-07-03) |
| Student list (read-only) | Working |
| Student detail — academic record, ShepherdAI, sections, relationships | Working |
| People & Roles — institution settings tiles | Working |

The following has code and mutations but **no working UI**:

| Feature | Status |
|---------|--------|
| Course sections — create/assign to periods | Read-only list only; no create/edit UI |
| Program Curriculum — required courses versioned by entry year | Does not exist |
| Student Program Membership — enroll student in a program with entry year | Does not exist |
| Section Enrollment — enroll a student in sections within a period | Does not exist |
| Student progress against program requirements | Does not exist |
| Grade entry | Does not exist |
| Transcript entries | Does not exist |
| Student Groups (cohorts) | Does not exist |

---

## What to Build Next (Priority Order)

Build in this exact order. Do not skip ahead. Each step depends on the previous one.

### Foundation — Must work before anything else

1. **Academic Periods UI** — Add/manage periods (terms, sessions) within an Academic Year from the settings page. Name, type (semester/quarter/trimester/block/module), start date, end date, sequence.

2. **Academic Year + Period Context Picker** — A persistent selector in the admin shell that sets the active year and period for the session. All subsequent screens respect this context.

3. **Course Catalog UI** — Create, edit, and archive courses. Fields: title, code, credit hours, clock hours, description, subject area, owning department. This is the catalog — not a section offering.

4. **Program Management UI** — Create, edit, and archive programs. Fields: name, code, credential type (certificate, diploma, bachelor's, master's, etc.), total required credits, description.

### Academic Structure — The core loop

5. **Program Curriculum per Academic Year** — For each Program + Academic Year combination, define the full curriculum: which courses are required, in which sequence (Year 1, Year 2, electives, prerequisites). This is the catalog year concept: the curriculum is versioned by year of entry. A student who enters in 2024 follows the 2024 curriculum forever, even if the program changes in 2026. The curriculum must be sequenced — not a flat list — so the system can calculate what comes next.

6. **Course Sections** — Within the active Academic Period, create sections: which course is being offered, instructor, capacity, modality, schedule. A section is one offering of a course in one period.

7. **Student Program Membership** — Enroll a student in a program with an entry year. The entry year determines which Program Library version applies to them for progress tracking.

8. **Section Enrollment** — Enroll a student in one or more sections within the active period.

### Outcomes and Progress

9. **Student Progress View** — Given a student's program membership and entry year, show:
   - Which required courses they have completed (passed)
   - Which required courses remain
   - Which remaining courses are available as sections in the current or upcoming period
   - What the recommended next courses are based on their position in the curriculum sequence
   This is deterministic calculation, not AI. ShepherdAI monitors anomalies and escalations on top of it.

10. **Grade Entry** — Record a grade for a student's enrollment in a section.

11. **Transcript Entry** — Snapshot the official result of a completed term. Preserved permanently — not recomputed from mutable joins.

### Groups

12. **Student Groups** — Create groups (cohorts, graduating classes, program cohorts) and assign students to them. Groups are scoped to an Academic Year.

---

## Definition of Done

**A feature is done when an admin can complete the workflow end-to-end in a browser without hitting a dead end, a 404, or a missing action.**

A passing build is not done. A passing lint is not done. A component that renders without crashing is not done. Done means the workflow is complete.

For every feature:
- The data is saved to the database
- The UI reflects the saved state after save (via refresh or optimistic update)
- Errors are shown to the user (not swallowed silently)
- Cross-tenant isolation is enforced
- The feature is accessible from a logical navigation path — not just a known URL

### Full Dependency Testing — No Shortcuts

**Testing a feature in isolation is not done.** Every feature test must exercise the complete data path that makes the feature possible. All prerequisite data must be created through the same functions the system uses in production — not stubbed, not seeded from mock data, not bypassed.

The rule: **if the feature depends on X existing, the test must create X.**

Examples:

- Testing enrollment → the test must also create the student (via `createPerson` + student profile), the academic year, the academic period, the course, and the course section — then enroll.
- Testing grade entry → the test must also create the enrollment, which requires the section, the student, and the period.
- Testing transcript entry → the test must also create and complete the enrollment with a recorded grade, not insert a raw transcript row.
- Testing program progress → the test must also create the program, the program library for the entry year, assign the student to the program with the correct entry year, then evaluate progress.

**No workarounds. No violations:**

- No mock data shortcuts that skip schema constraints
- No in-memory substitutes for required prior data
- No raw PII or PHI in test output — SHA-256 hash sensitive old values in audit events, `doesNotMatch` checks on every result
- No schema deviations — every insert must satisfy real foreign key and constraint rules
- No cross-tenant shortcuts — every function must reject out-of-tenant access even in tests

**The principle:** Take the longest road that makes everything work correctly, or do not ship. A test that passes by bypassing the real data dependencies is not a test — it is a liability that will fail silently in production.

---

## The LMS Relationship

**ChurchCore LMS is a first-party product in the ChurchCore platform.** It is not a third-party adapter — it is built and maintained by the same team. The integration between ChurchCore Academy and ChurchCore LMS is bundled and out-of-the-box: a customer who buys Academy can bundle ChurchCore LMS, and a customer who starts with ChurchCore LMS can add Academy.

The `lms-contract` module in this repository holds the provider-neutral interface. ChurchCore LMS is the **primary** integration target. Moodle and Canvas are secondary adapters for institutions that already have an LMS.

The Academy ↔ ChurchCore LMS integration contract covers:

- SSO launch and logout (Academy initiates, LMS authenticates)
- Roster and enrollment sync (Academy is the system of record — pushes to LMS)
- Grade and progress sync (LMS reports back to Academy)
- Webhook/event callbacks for completion, attendance, and assessment results

**The integration cannot be built until Academy has data to push.** This is why LMS roster sync is deferred — the SIS must have academic years, periods, courses, sections, and enrollments before it can feed the LMS.

---

## What NOT to Build Yet

The following are explicitly out of scope until the Core Academic Loop (steps 1–10 above) works completely:

- Bulk import of students, courses, or programs
- ChurchCore LMS roster sync (Academy must have enrollment data before it can push to LMS)
- ShepherdAI recommendations for academic progress (needs grade and progress data first)
- Guardian portal (needs working enrollment data first)
- Student PWA (needs working academic record first)
- Financial management, billing, or tuition
- Attendance tracking
- FERPA consent management UI
- Reporting or analytics exports
- Multi-campus management
- Accreditation compliance workflows

---

## Design Principles for Agents

These principles come directly from how the best SIS platforms are designed. Follow them.

**1. Time-bound everything.** Program memberships have start dates. Enrollments have start and end dates. Status changes are dated, not overwritten. Never update a row to change historical truth — add a new row or a status history entry.

**2. The write path is normalized, the read path is denormalized.** Never denormalize the authoritative tables. Build read models and projections for dashboards and lists.

**3. Catalog year is sacred.** A student follows the program requirements from their year of entry. Changing a program's required courses must not retroactively change what existing students owe. The Program Library is versioned by Academic Year.

**4. Transcript entries are immutable snapshots.** When a term closes and grades are posted, transcript entries are written. They are never recomputed. They may be amended only through an explicit administrative correction process with an audit trail.

**5. The context picker scopes everything.** Every data query in the admin UI that is period-sensitive must respect the active Academic Year and Period from the context picker.

**6. Working in the browser beats passing the build.** Every PR must include a description of the workflow that was tested in the browser, not just test counts and build status.

---

## What ChurchCore Academy Is Not

- Not an LMS. Does not deliver courses. ChurchCore LMS does that (first-party, bundled). Moodle and Canvas are secondary adapters for institutions that bring their own LMS.
- Not a church management system. ChurchCore Ops handles congregation management.
- Not a financial system. Tuition and billing are out of scope for this phase.
- Not a chatbot. ShepherdAI is a deterministic academic workflow signal engine, not a conversational assistant.
- Not a general-purpose school administration tool. It is faith-based and must support the specific operating patterns of Christian schools, Bible colleges, and seminaries.
