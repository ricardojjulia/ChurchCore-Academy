# Uncoached Pilot Session Protocol

Date: 2026-10-05
Status: Ready for local controlled-pilot evidence

## Purpose

Use this protocol to observe whether a representative Bible school, seminary, or ministry institute can complete Academy's core workflows without coaching. This is an evidence session, not a product demonstration, sales presentation, or test-script recital.

The session may run against the approved local Academy and local Supabase environment. It does not authorize hosted deployment, live providers, production records, or unrestricted official-record use.

## Roles

- **Participant:** completes tasks using only the task prompts below. The participant should not have implementation knowledge.
- **Observer:** records behavior and asks neutral follow-up questions. The observer must not explain navigation, name controls, or rescue the participant unless a stop condition applies.
- **Operator:** prepares the local environment and test identities, keeps secrets out of evidence, and handles technical stop conditions. The observer and operator may be the same person, but must preserve the no-coaching rule.

## Readiness Checklist

Before inviting the participant:

- [ ] `main` matches `origin/main` and the worktree is clean.
- [ ] Node and Supabase CLI versions satisfy the repository requirements.
- [ ] Local Supabase is running and `.env.local` points only to the intended local instance.
- [ ] `npm run verify:pilot-readiness` passes while the Academy server is running.
- [ ] Migrations and the local seed complete without errors.
- [ ] `npm run verify:role-walkthrough` regenerates the role-matrix evidence for the session base URL.
- [ ] The Academy production build starts locally and the login page loads from the participant's browser or VM.
- [ ] Representative admin, registrar, faculty, student, guardian, finance, and admissions accounts can authenticate.
- [ ] No real student, guardian, payment, pastoral, or applicant data is present.
- [ ] Screen recording or screenshots are approved by the participant and contain no passwords or secret values.
- [ ] The observer has a fresh copy of the evidence log below.

If the application runs on one machine and the participant uses a VM, do not use `localhost` in the VM unless Academy and Supabase also run inside that VM. Use an explicitly approved private host address and ensure Supabase's public URL and auth redirect configuration are reachable from the VM. Do not expose the local stack to the public internet for this session.

The readiness command rejects public hosts, classifies each accepted endpoint as loopback or private-network, checks Supabase Auth, opens a real Postgres connection, fails if any file in `supabase/migrations/` is not applied to that database, and verifies the Academy login page. It prints endpoint origins only, never credentials. During early setup, `npm run verify:pilot-readiness -- --skip-app` may be used before the Academy server is started; the final pre-session run must not skip the app check. Because browser reachability depends on where the browser runs, the operator must still confirm the login and auth flow from inside the participant VM.

## Session Opening

Read this statement to the participant:

> We are evaluating the product, not you. Please work as you normally would, think aloud when comfortable, and tell us when wording or navigation is unclear. I will not guide you to the answer. If you become stuck, say what you expected to happen and what you would try next in real work.

Record the participant's institution type and job function. Do not record their name in the repository evidence.

## Uncoached Tasks

Give one task at a time. Do not reveal routes, menu names, field labels, or the expected click path.

### Institution administrator

1. Confirm which academic year and period you are working in.
2. Find an existing student and determine their current program and academic progress.
3. Create a saved report using only the fields you would be comfortable sharing with an authorized colleague, then export it.
4. Find the institution's current faculty-load picture and identify anything requiring human review.

### Admissions and registrar

5. Find an applicant awaiting a decision and explain what you would do next. Do not send real communications.
6. Find where an accepted applicant proceeds toward student conversion.
7. Find a student's section registrations and transcript record, then explain which result is official.

### Faculty

8. Find your assigned teaching work for the active period.
9. Find where attendance and grades are recorded for one of your sections. Do not alter an official result unless the operator prepared a disposable record for that purpose.
10. Identify one student who may need academic follow-up and explain what evidence the system provides.

### Student and guardian

11. As a student, find your schedule, current courses, account information, and released academic documents.
12. As a guardian, find the information available for the linked learner and describe anything expected but absent.

### Access-boundary probes

13. While signed in as a student or guardian, attempt to reach an administrative area using normal navigation and a direct URL supplied by the operator.
14. While signed in as ordinary institution staff, attempt the concealed HQ route supplied by the operator. Record only whether access is denied; do not disclose the route in participant-facing materials.

## Observer Rules

- Allow at least two minutes of exploration before marking a task blocked.
- Ask only neutral questions such as "What did you expect?" or "What would you try next?"
- Record the participant's first path, backtracking, labels they searched for, and whether they recognized success.
- Distinguish a product failure from environment failure, missing test data, or observer intervention.
- Never copy passwords, tokens, raw database errors, stack traces, or sensitive record contents into the evidence log.
- Stop immediately for suspected cross-tenant exposure, unintended access to sensitive data, destructive official-record changes, or an environment pointing at a non-local database.

## Evidence Log

Copy this table into a dated file under `docs/reports/` after the session. Use anonymous participant labels such as `P1`.

| Task | Role | Outcome | Time | Coaching | Observation | Evidence | Severity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | admin | pass / friction / blocked / not run |  | none / neutral prompt / rescue |  | screenshot or timestamp | S0-S3 |

Also record:

- Session date, Academy commit, browser, viewport, base URL classification (`local` only), and local Supabase status.
- Participant profile: institution type, job function, and prior SIS familiarity; no personal identity.
- Console errors by sanitized summary and timestamp, never raw secrets or private records.
- Any observer intervention and the exact reason.
- Participant closing answers: most confusing moment, least trustworthy moment, missing capability, and whether they could perform their job without assistance.

## Severity And Stop Criteria

| Severity | Meaning | Action |
| --- | --- | --- |
| S0 | Security, privacy, tenant-isolation, or official-record integrity risk | Stop the session, preserve sanitized evidence, and open a blocking fix through the software factory. |
| S1 | Core workflow cannot be completed without coaching or a hidden/direct route | Create a P0/P1 story before further pilot expansion. |
| S2 | Workflow completes with material confusion, repeated backtracking, or misleading state | Create a story only when the observation is reproducible and affects adoption. |
| S3 | Cosmetic preference or optional enhancement | Record it; do not automatically create backlog work. |

Environment failures and missing fixture data are labeled separately and do not become product stories until reproduced as product defects.

## Closeout

1. Preserve the raw evidence outside the repository if it contains participant identity or sensitive screenshots.
2. Commit only a sanitized session report.
3. Convert reproducible S0-S2 observations into bounded factory stories with acceptance criteria and explicit non-goals.
4. Do not implement requested features merely because they were mentioned; prioritize demonstrated workflow failure or adoption impact.
5. Update the canonical development guide only when the evidence changes product priority or readiness status.
