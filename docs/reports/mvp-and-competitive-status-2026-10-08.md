# ChurchCore Academy - MVP and Competitive Status

Date: 2026-10-08  
Scope: protected `main` through PR `#238`, plus the write-path integrity closeout awaiting delivery  
Status: current repository evaluation

## Bottom Line

ChurchCore Academy remains a strong controlled-pilot candidate for faith-based Bible schools,
seminaries, ministry institutes, and similar small institutions that do not require U.S. Title IV
automation on day one. It is not approved for GA, unrestricted production official-record use, or
live provider activation.

The functional MVP is broad and the Core Academic Loop is automated, but the October operator dry
run proved that feature presence and green request responses were insufficient evidence of reliable
persistence. Attendance repair, database read-back, the unexpected-Postgres-error CI guard, static
swallowed-error review, and the current guardian preference closeout materially strengthen that
claim. The correct current statement is **repository MVP implemented and integrity-gated; real-user
fit and live operations remain unproven**.

## Progress Since The 2026-10-02 Evaluation

| Outcome | Evidence |
| --- | --- |
| Faculty-load unknown values and primary workflow | PR `#217` |
| OpenRouter routing and concealed governed HQ | PRs `#218` and `#220` |
| Local pilot protocol and readiness | PR `#221`; participant session later deferred by owner |
| Role-aware navigation, enrollment dates, migration readiness, pilot seed | PRs `#226`-`#230` |
| Attendance persistence and read-back after dry-run failure | PR `#232` |
| Section roster and admissions database-error hardening | PRs `#233` and `#236` |
| Permanent unexpected-Postgres-error E2E guard | PR `#235` |
| Reproducible Supabase CLI and E2E selector closeout | PRs `#237` and `#238` |
| Guardian preference persistence and integrity matrix | Current protected-PR candidate |

## Current Readiness

| Area | Assessment |
| --- | --- |
| Core Academic Loop | Implemented, browser/API automated, and persistence checked |
| Admissions through conversion | Implemented with decision, agreement, and database-error guards |
| Admin, faculty, student, guardian, applicant surfaces | Implemented and role-gated |
| Write-path integrity | Stronger: runtime Postgres guard, static swallow review, and coverage matrix; final full reset evidence required for this closeout |
| Tenant and authorization boundaries | Enforced in service/data paths with cross-tenant coverage sized to sensitive workflows |
| LMS contracts | Repository implementation present; external Moodle/Canvas activation evidence remains |
| Payments and communications | Repository boundaries present; live-provider operations remain gated |
| Real-institution usability and willingness to pay | Unproven; uncoached pilot deferred |
| Hosted operations | Not started; explicit owner approval required |
| Title IV replacement | Not ready; FAFSA/ISIR and COD are not implemented or approved |

## Competitive Position

Academy's strongest differentiators remain its faith-specific formation and denominational records,
configurable academic model, integrated role portals, provider-neutral LMS boundary, and explainable
human-reviewed academic workflows. The recent reliability work improves credibility against small-
institution SIS alternatives because critical writes are now judged by persisted read-back, not UI
success alone.

The product still cannot responsibly claim mature-market operational parity. It lacks real-
institution participant evidence, hosted backup/restore and observability exercises, live payment
and communications proof, provider sandbox activation, certified regulatory filings, and Title IV
automation.

## Recommended Next Move

Finish the current reset-backed integrity gate and protected PR. Do not add speculative parity
features next. When the owner resumes the deferred uncoached pilot, use the prepared local protocol
and add three viability questions: current SIS spend, willingness to pay for Academy without the
ChurchCore LMS, and estimated data-migration hours. Convert only observed blockers into factory
stories.

## Residual Boundaries

- This evaluation does not authorize deployment, public exposure, hosted resources, or live providers.
- It does not convert operator dry-run evidence into participant usability evidence.
- Expected HQ append-only and RLS rejection errors are deliberate test evidence; every other
  Postgres error must fail the E2E run.
- Any future customer-facing or student-data AI surface still requires the separate privacy,
  anonymization, Council, and owner gates already recorded in the canonical guide.

