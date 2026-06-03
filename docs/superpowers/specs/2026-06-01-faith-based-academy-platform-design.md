# Faith-Based Academy Platform Design

## Summary

ChurchCore Academy will be repositioned from a college-focused SIS into a configurable faith-based education management system for Bible schools, children's schools, seminaries, colleges, and universities.

The platform remains the Academy system of record. It owns institution structure, academic calendars, students, guardians, faculty, teachers, courses, sections, grading, transcripts, student PWA workflows, and academic workflow recommendations. LMS products such as Moodle and Canvas remain external providers accessed through contracts.

## Goals

- Make the product identity clearly faith-based and education-management focused.
- Support multiple institution types without separate products.
- Model academic years, sub-divisions, course types, course durations, grading, faculty, teachers, student records, and student PWA workflows.
- Support Moodle first, Canvas second, and no-LMS mode through provider adapters.
- Keep ShepherdAI Academy deterministic, explainable, and constrained to Academy-owned data.

## Factory Review Status

This platform design has been reviewed through the ChurchCore Academy software factory.

- Context layer: pass; relevant product, architecture, LMS, and ShepherdAI docs are identified.
- Knowledge layer: pass; this spec is part of the durable repository knowledge set.
- Agent layer: pass; the design maps to focused product, domain, data, frontend, backend, LMS, ShepherdAI, test, and security roles.
- Workflow layer: pass with constraint; this is a platform-level design and must be decomposed into detailed implementation plans before code.
- Delivery layer: pass with constraint; each implementation package must include tests, lint, build, and any relevant browser, migration, API, or provider-contract checks.

## Non-Goals

- Do not add Moodle runtime code to this repository.
- Do not add Canvas runtime internals to this repository.
- Do not make Academy a course-delivery LMS.
- Do not let ShepherdAI become a chatbot or infer spiritual condition.

## Architecture

Academy will be organized around provider-neutral domain modules:

- Institution configuration
- Academic calendar
- Course catalog and sections
- Grading and transcript rules
- People and roles
- Student PWA workflows
- LMS provider contract
- ShepherdAI Academy workflow recommendations

The LMS provider layer exposes one Academy-owned contract with separate Moodle and Canvas adapters. Academy business logic calls the contract, not provider-specific APIs.

## Security And Privacy

The following areas require explicit security and privacy review in every implementation plan:

- student records
- guardian relationships
- grades and transcripts
- attendance if implemented for children's school mode
- LMS identity launch and roster sync
- LMS grade or progress return
- ShepherdAI signal inputs and explanations
- role-scoped access for students, guardians, teachers, professors, registrars, and administrators

No feature may expose student, guardian, grade, transcript, or LMS sync data without an access-control check and a test or documented verification step.

## Institution Model

Each tenant configures:

- institution type: Bible school, children's school, seminary, college, university, or mixed
- campuses and locations
- divisions, departments, schools, or grade bands
- academic calendars and operating rules
- program and credential types
- student lifecycle states
- supported LMS provider

## Academic Calendar Model

The calendar model supports:

- academic years
- terms, semesters, quarters, trimesters, sessions, and modules
- enrollment windows
- add/drop windows
- grading windows
- holidays and closure days
- transcript periods

## Course Model

The course model supports:

- course catalog entries
- course type
- duration type
- credits or clock hours
- prerequisites
- sections
- delivery mode
- assigned teachers or professors
- LMS course shell mapping

## Grading Model

The grading model supports:

- grading scales
- numeric, letter, pass/fail, competency, and narrative grading
- grade bands
- GPA and weighted GPA rules
- transcript rules
- academic standing rules
- promotion and graduation rules

## Student PWA

The student PWA exposes:

- schedule
- courses and sections
- grades
- academic progress
- documents
- registration
- messages and announcements
- transcript requests
- graduation readiness
- LMS launch

## LMS Provider Strategy

The platform supports:

- no-LMS mode
- Moodle provider
- Canvas provider

Moodle is first because it is open source under GPL, self-hostable, customizable, and practical for smaller faith-based institutions. Canvas remains a second adapter because it is open source under AGPLv3 and has a strong REST API, but it is operationally heavier and often better suited to institutions already invested in Canvas.

## ShepherdAI Academy

ShepherdAI Academy remains an explainable Academic Workflow recommendation engine. It may recommend staff-reviewed academic workflows based on Academy data such as enrollment gaps, missing documents, grading setup inconsistencies, academic standing, transcript readiness, and unassigned courses.

It must not use LMS engagement, counseling records, giving records, church attendance, devotional activity, ministry participation, or inferred spiritual condition.

## Factory Acceptance Criteria

Before any major implementation derived from this spec is considered complete:

- product area and institution modes are named
- Academy/LMS boundary is respected
- data model changes are tenant-aware
- auth and role access are accounted for
- migrations and seed data are verified when schema changes exist
- tests cover deterministic domain rules
- UI or PWA changes are visually checked
- `npm test`, `npm run lint`, and `npm run build` pass
- docs are updated when product direction, architecture, operations, or provider setup changes

## Source Notes

- Moodle open source overview: https://moodle.com/about/open-source/
- Moodle downloads and GPL license note: https://download.moodle.org/
- Moodle External Services: https://moodledev.io/docs/5.3/apis/subsystems/external
- Canvas LMS GitHub and AGPLv3 license: https://github.com/instructure/canvas-lms
- Canvas REST API: https://canvas.instructure.com/doc/api/
