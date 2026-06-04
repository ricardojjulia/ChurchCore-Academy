# ADR 0012: Student PWA Routing And Offline Strategy

Date: 2026-06-03
Status: accepted

## Context

ChurchCore Academy must serve students across Bible schools, children's schools, seminaries, colleges, universities, and mixed institutions. The student experience needs to work well on mobile devices, support installability, and remain usable when connectivity is weak.

At the same time, the PWA may expose sensitive student records, minor-related guardian data, released academic progress, and future LMS launch actions. Offline behavior must not create a privacy leak by caching too much too early.

## Decision

ChurchCore Academy will use one Student PWA route family under `/student`.

The first implementation slice will create the shell, navigation, manifest, and safe placeholder surfaces. Data-heavy student pages will be added through later student-scoped read-model sprints.

Offline behavior will start conservatively:

- cache only the application shell and static assets when PWA runtime support is introduced
- show safe empty or unavailable states when student data cannot be loaded
- avoid offline mutations in early PWA work
- avoid offline caching of full academic records until cache invalidation, logout purge, and privacy posture are explicitly reviewed

The route family may include dashboard, courses, schedule, progress, documents, messages, and LMS launch pages, but each page must consume PWA-specific read models instead of raw Academy tables.

## Consequences

This gives the product one coherent mobile experience without duplicating apps by institution type.

It also keeps privacy risk bounded while the PWA matures. Students get a stable route and installable shell early, while sensitive data exposure waits for explicit read-model and cache review work.

The tradeoff is that early PWA slices will show placeholders before the full student dashboard is data-rich.

## Alternatives Considered

College-style portal routes:

- rejected because they encourage transcript, semester, credit, and GPA assumptions that do not fit children's schools or Bible schools

Separate PWA per institution mode:

- rejected because it duplicates shell, navigation, installability, access control, and verification work

LMS-first student app:

- rejected because Academy is the SIS system of record and must support no-LMS institutions

Single `/student` route family with conservative offline behavior:

- accepted because it supports all institution modes while controlling privacy and offline-cache risk

## Review Notes

- Product boundary: the Student PWA is an Academy SIS surface, not a Moodle or Canvas wrapper.
- Security/privacy: offline caching of student academic data requires a later explicit review before implementation.
- Testing: implementation must include desktop, mobile, keyboard, console-error, manifest, and later offline-shell verification.
- Rollback: this sprint changes docs only; future route work can be reverted without changing academic records.
