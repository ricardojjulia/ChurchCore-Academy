# Pre-Production MVP Readiness Release Note

Date: 2026-06-21  
Status: pre-production controlled-pilot candidate  
Governing review: `docs/reviews/2026-06-21-council-review-8-post-slice-9-mvp-competitiveness.md`

## Summary

ChurchCore Academy has completed the major ADR-0033 workflow slices through LMS execution-worker boundaries. The product now has production-shaped foundations for the core SIS workflows needed for controlled pilot evaluation.

## Shipped Foundations

- verified-session identity, request-scoped database context, forced RLS, and immutable audit evidence
- admissions application, decision, and conversion into student/enrollment/period registration
- course-section registration and enrollment confirmation
- attendance capture and registrar grade posting
- transcript request, issuance, hold, release, revoke, and print/export filtering
- billing ledger, payment-intent boundary, and student account view
- institutional financial-aid foundation with regulated-aid activation gate
- reporting dashboard and CSV export foundation
- communications queue, in-app messages, templates, and provider-safe email boundary
- Student PWA workflow surfaces
- Moodle/Canvas/no-LMS provider contract foundations and executable worker boundary

## Not Yet Approved

- general availability
- production official-record use
- live payment checkout and settlement
- live email/SMS delivery
- live Moodle/Canvas HTTP clients with tenant credentials
- regulated/federal aid
- autonomous AI academic or pastoral decisions

## Next Release Gate

ADR-0038 must complete:

- role-matrix acceptance
- migration/seed/live-tenant rehearsal
- deployment operations runbook
- provider activation checklists
- final council release decision
