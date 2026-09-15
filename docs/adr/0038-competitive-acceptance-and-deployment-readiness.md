# ADR-0038 — Competitive Acceptance And Deployment Readiness

**Status:** Accepted  
**Date:** 2026-06-21  
**Deciders:** Council Review VIII, Ricardo Julia  

## Context

ADR-0033 moved ChurchCore Academy from broad foundations into factory-governed workflow slices. Slices 1-9 have now delivered the major pre-production SIS workflow foundations: registration, attendance, grade posting, transcripts, billing, aid, reporting, communications, Student PWA workflows, and LMS execution-worker boundaries.

The remaining risk is no longer primarily "missing screens." The remaining risk is acceptance evidence, deployment readiness, live provider activation, operational procedures, and truthful market positioning.

## Decision

ChurchCore Academy will enter a **Competitive Acceptance And Deployment Readiness Program** before any production or general-availability claim.

The program must produce:

1. role-matrix acceptance evidence for admin, registrar, faculty, student, guardian, finance, admissions, and platform admin;
2. browser or HTTP-backed workflow evidence for every primary route family;
3. migration, seed, and live-tenant rehearsal evidence;
4. deployment runbook covering environment variables, database migrations, backup, monitoring, incident response, and rollback;
5. provider activation checklists for payment checkout, email/SMS, Moodle, Canvas, and regulated aid;
6. release notes and final council closeout;
7. an explicit release decision of `ship controlled pilot`, `defer`, or `split`.

## Consequences

Positive:

- The project avoids overstating MVP readiness.
- The factory gets a concrete final gate instead of indefinite polish.
- Provider activation is separated from domain workflow correctness.
- The final release decision is reviewable and auditable.

Negative:

- The product remains pre-production until the acceptance package is complete.
- Live payments, email/SMS, LMS clients, and regulated aid require additional configuration and possibly external service accounts.
- Browser verification remains a dependency for complete UX confidence.

## Alternatives Considered

### Declare MVP complete after Slice 9

Rejected. The workflow foundations are strong, but deployment and acceptance evidence are still incomplete.

### Keep building new features before acceptance

Rejected. New features would hide unresolved release risk and delay a trustworthy pilot decision.

### Activate providers ad hoc

Rejected. Payments, communications, LMS, and regulated aid each need explicit activation checklists, secrets handling, and rollback plans.

## Review Notes

- **Product boundary:** Academy remains the SIS and official-record authority; providers remain delivery systems.
- **Security/privacy:** Acceptance must prove tenant, role, guardian, transcript, billing, aid, LMS, and Student PWA boundaries.
- **Testing:** `npm test`, `npm run lint`, `npm run build`, role-matrix checks, route/browser smoke, migration/seed rehearsal, and provider-boundary tests are required.
- **Rollback:** Code rollback is standard Git rollback; database rollback uses forward recovery for immutable audit/event records.
