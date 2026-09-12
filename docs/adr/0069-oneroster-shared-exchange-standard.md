# ADR 0069: OneRoster As The Shared Academy LMS Exchange Standard

Date: 2026-09-12
Status: Accepted
Deciders: Architecture Council
Tags: interoperability, oneroster, lms, academy, sis

## Context

ChurchCore Academy is the SIS and system of record. ChurchCore LMS is the first-party learning runtime. The two systems need a professional, auditable, standards-based exchange layer for organizations, users, academic sessions, courses, classes, enrollments, and gradebook outcomes.

The existing Academy `lms-contract` module already models identity launch, roster sync, enrollment sync, grade return, progress return, webhooks, and reconciliation. The LMS repository already contains a OneRoster CSV importer, staging model, preview/apply functions, provenance guards, and existing-profile identity linking.

1EdTech OneRoster is the closest fit for this boundary. Ed-Fi remains the broader SIS/data-hub reference model. PESC remains the official transcript and registrar exchange lane. 1EdTech CLR remains the learner-owned credential lane.

## Decision

ChurchCore Academy and ChurchCore LMS will use OneRoster as their shared alignment and communication standard for roster, enrollment, class, course, academic-session, and gradebook exchange.

The canonical direction is:

1. Academy exports OneRoster 1.2 CSV packages and later serves OneRoster Rostering Service endpoints as the system of record.
2. LMS imports OneRoster 1.2 packages and later consumes Academy's OneRoster Rostering Service.
3. LMS returns grades and progress through reviewed OneRoster Gradebook Service style payloads; Academy stores them as pending reviewed imports until a registrar-approved workflow posts official records.
4. Neither system treats OneRoster as an authentication authority. Roster users link to existing accounts or pass through an approved provisioning workflow.
5. OneRoster provenance, source status, idempotency keys, reconciliation reports, and audit evidence are mandatory for every sync.

## Consequences

- Academy and LMS stop inventing ad hoc roster/enrollment/grade payloads.
- Academy remains the source of truth for SIS facts.
- LMS remains independently usable in standalone mode.
- OneRoster-owned LMS fields must be guarded from native edits that would break source alignment.
- Automatic Auth user provisioning is not approved by this ADR.
- PESC, CLR, Ed-Fi, Caliper, LTI, and Edu-API can be added later without weakening the OneRoster boundary.
