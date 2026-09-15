# Story: Student PWA Full Self-Service
**ID:** T3-06
**Tier:** 3 — Achieve Competitive Differentiation
**Status:** Implemented in Sprint C / PR #63
**Date:** 2026-06-22

## User Story
As a student, I want to manage my own enrollment, pay my bill, request transcripts, and update my contact information from my phone — without calling or emailing the registrar's office for routine tasks.

## Background
The student PWA has fully rendered routes for courses, schedule, documents, account, aid, and settings — all backed by real database data. Every actionable item on every screen shows "Contact your institution" or a disabled button. The PWA is a read-only dashboard. Students at competitor institutions (Populi, Sycamore) can register for courses, pay bills, and request transcripts from mobile. This story makes the PWA a real self-service tool.

## Acceptance Criteria
1. **Course Registration (during enrollment window):** Student sees available sections and can add/drop from the courses page. (Delegates to T2-09 backend.)
2. **Bill Payment:** Student sees their balance and a "Pay Now" button (during open billing) that initiates a Stripe Checkout session. (Delegates to T2-01 Stripe backend.)
3. **Transcript Request:** Student can tap "Request Transcript" on the documents page, fill out recipient and delivery info, and submit. (Delegates to T1-05 backend.)
4. **Contact Info Update:** Student can update phone number, mailing address, and emergency contact from the account/settings page. (Delegates to T2-11 backend.)
5. **Aid Award Acceptance:** Student sees their financial aid award package and can tap "Accept Award" or "Decline Award". (Delegates to T3-07 backend.)
6. **Notification Preferences:** Student can toggle which communication categories they opt into (billing notices, advising notices, academic announcements).
7. All self-service actions show loading state during submission and a success/error confirmation message.
8. No self-service action is available when the relevant window is closed (enrollment closed = registration disabled, billing period closed = payment disabled).

## Edge Cases
- Student taps "Pay Now" with zero balance: button is hidden (balance must be > 0).
- Student tries to add a course that is at capacity: error message shown in-app.
- Stripe Checkout session times out (user didn't complete payment): student returns to PWA with no charge; can retry.
- Student drops all courses from PWA: warning modal shown (mirrors T2-09 behavior).
- Notification preference toggle: change takes effect immediately; confirmation toast shown.
- Offline state: self-service action buttons are disabled with "You're offline" tooltip.

## Out of Scope
- Grade disputes / grade appeals (Tier 4)
- Leave of absence requests (Tier 4)
- Degree audit self-service (Tier 4)
- Waitlist management (Tier 4)

## Role Matrix
| Role | Register/Drop | Pay Bill | Request Transcript | Update Contact | Accept Aid |
|------|:------------:|:--------:|:-----------------:|:--------------:|:----------:|
| Student | Own / window | Own | Own | Own | Own |
| Admin | Via admin UI | Via admin UI | Via admin UI | Via admin UI | Via admin UI |

## Technical Notes
- This story is a PWA-layer orchestration story — it wires existing backend endpoints to PWA UI actions
- Pages to update: `src/app/student/courses/page.tsx`, `src/app/student/account/page.tsx`, `src/app/student/documents/page.tsx`, `src/app/student/aid/page.tsx`
- Loading states: use a loading overlay or button loading prop during API calls
- Error display: use toast notifications for action feedback
- Enrollment window: read `enrollment_open_at` / `enrollment_close_at` from term data in the page model
- Offline detection: use PWA Service Worker `navigator.onLine` check before showing action buttons
- Dependencies: T1-05, T2-01, T2-09, T2-11, T3-07 backends must exist before UI can be wired

## Tests Required
(Unit tests for PWA self-service are primarily integration tests; the underlying backend stories carry the unit test requirements. The following are page-model and route tests.)
- `loadStudentPwaPageModel()` includes: balance, enrollment window status, active aid package, issuance request status.
- `POST /api/academy/transcripts/request` from student session: success path creates record.
- `PATCH /api/academy/students/[id]/contact` from student session: updates own contact, rejects other student's contact.
- `GET /student/account` with billing hold: payment button disabled, hold message shown.
- `GET /student/courses` outside enrollment window: add/drop buttons not rendered.
