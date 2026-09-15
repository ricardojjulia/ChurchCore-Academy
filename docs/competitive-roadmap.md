# ChurchCore Academy — Competitive Roadmap
## The Single-Pricing, All-Institution-Types SIS

**Established:** 2026-06-22 (Council Review X)
**Status:** ACTIVE DIRECTIVE — Nothing else ships until this plan is complete
**Last Updated:** 2026-06-25

---

## Mission

ChurchCore Academy will be the first SIS on the market that serves Bible schools, seminaries,
K–12 faith schools, and colleges in a single product under a single price. No competitor offers
this. Populi owns Bible colleges. Sycamore owns K–12. FACTS owns Catholic schools. We own all of
them — and we out-feature them on the workflows that matter most to faith-based institutions.

**Target position:** The most comprehensive, most affordable, most faith-native SIS in the market.
**Pricing model:** Single flat price per active student — all institution types, all features, no add-on tiers.

---

## Honest State — June 2026

The project-status.md and earlier council docs describe designed/planned coverage. The June 2026
feature audit of actual running code produced a different result. This roadmap governs from the
**actual** state, not the designed state.

| Domain | Actual Status | What actually runs |
|--------|--------------|-------------------|
| Auth + tenant isolation | **WORKING** | Real RLS, Supabase SSR, verified sessions |
| Platform control panel | **WORKING** | Tenant create, staff invite, demo seeding |
| Admissions (staff review) | **PARTIAL** | Decision workflow, conversion to student — no public intake |
| Student records (read) | **PARTIAL** | Index + profile reads — no editable fields, no advisor notes |
| Academic calendar (schema) | **PARTIAL** | DB schema + review view — no admin CRUD |
| Course catalog (read) | **PARTIAL** | Read surfaces only — no create/edit forms |
| Enrollment/registration | **PARTIAL** | Service + DB wired — no student self-registration |
| Attendance | **PARTIAL** | Faculty entry + aggregate view — no alerts or enforcement |
| Gradebook | **PARTIAL** | Grade entry + posting queue — GPA auto-computed on post — no assignment creation |
| Transcripts | **PARTIAL** | Issuance records + hold/release — no PDF, no grade-history assembly |
| ShepherdAI signals | **WORKING** | Signal engine + Postgres read — dismiss note, snooze, and promote all persisted |
| Student PWA | **PARTIAL** | All routes + real DB reads — **read-only, no self-service** |
| Guardian portal | **PARTIAL** | Scoped access with FERPA restriction, attendance/grade summaries — no guardian PWA shell |
| Billing | **PARTIAL** | Ledger + manual posting — **Stripe not wired** |
| Financial aid | **PARTIAL** | Aid packages + awards — no FAFSA, federal aid gate blocked |
| Communications | **WORKING** | Queue + templates + Resend email worker — Vercel Cron delivers queued messages |
| Reporting | **PARTIAL** | 5 report types + CSV — no IPEDS, no scheduled delivery |
| LMS integration | **WORKING** | Moodle + Canvas HTTP clients live — enrollment, grade sync, progress return, circuit breaker |
| Ministry Formation Records | **WORKING** | Module, DB, API routes, pastoral note privacy enforced |
| Public applicant portal | **WORKING** | `/apply` public form + `/apply/status` token check + staff queue integration |
| Denomination integration | **WORKING** | Membership sync, ordination tracking, denomination roster API |
| Alumni CRM | **WORKING** | Post-graduation records, giving module, alumni directory API |

---

## Competitive Positioning

| Capability | Populi | Sycamore | FACTS | **ChurchCore Academy** |
|------------|:------:|:--------:|:-----:|:---------------------:|
| Bible school / seminary native | ✓ | ✗ | ✗ | **Target: ✓** |
| K–12 + college in one product | ✗ | ✗ | ✗ | **Target: ✓** |
| Self-service applicant portal | ✓ | ✓ | ✓ | ✗ → Tier 1 |
| Online tuition collection | ✓ | ✓ | ✓ | ✗ → Tier 1 |
| Email delivery (working) | ✓ | ✓ | ✓ | ✗ → Tier 1 |
| LMS launch (live) | ✓ | △ | ✗ | ✗ → Tier 2 |
| AI-driven early alert | ✗ | ✗ | ✗ | △ → Tier 1 (persist) |
| Student mobile PWA | △ | ✗ | ✗ | ✓ (read-only now) |
| Ministry Formation Records | ✗ | ✗ | ✗ | **Target: ✓** |
| Faith denomination integration | △ | △ | △ | ✓ |
| Single price, all types | ✗ | ✗ | ✗ | **Target: ✓** |

**Competitive milestone (90 days):** Stripe live + public portal + email + ShepherdAI persisted =
competitive against Populi for every seminary and Bible college buyer.

**Market leadership milestone (180 days):** Ministry Formation Records + multi-type config
demonstrated + LMS live = no competitor can match this offering.

---

## The Five Immediate Blockers

These prevent any real school from using ChurchCore Academy today. Nothing else takes priority.

1. **ShepherdAI workflow actions not persisted** — Staff cannot track workflow items between page
   loads. Every promote/dismiss/snooze resets on reload. Fixes the flagship feature.

2. **No email delivery** — All communications (acceptance letters, grade releases, billing notices,
   ShepherdAI alerts) queue to DB and never send. The queue is a dead-end.

3. **No public applicant portal** — External applicants cannot submit applications. `/admissions`
   redirects to the staff admin page. No intake funnel exists.

4. **No payment collection** — Stripe is type-modeled but zero Stripe API calls exist in the
   codebase. No tuition collection, no payment plans, no student checkout.

5. **LMS integration has no HTTP calls** — The adapter design is complete. No `fetch()` calls
   exist in any adapter. Students cannot launch Moodle or Canvas courses.

---

## Full Feature Execution Plan

### TIER 1 — Unblock Basic Operations
*Goal: A real school can run its first week.*
*Target: 30 days*

| # | Feature | Status | Story | ADR | Brief | Done |
|---|---------|--------|-------|-----|-------|------|
| T1-01 | ShepherdAI workflow action persistence (promote/dismiss/snooze/resolve → Postgres) | PARTIAL | [Story](superpowers/specs/T1-01-shepherd-ai-workflow-action-persistence.md) | [ADR-0039](adr/0039-shepherd-ai-workflow-action-persistence.md) | — | ☒ |
| T1-02 | Email delivery provider (Resend wired to existing queue) | MISSING | [Story](superpowers/specs/T1-02-email-delivery-provider.md) | [ADR-0040](adr/0040-email-delivery-provider-and-queue-worker.md) | — | ☒ |
| T1-03 | Public applicant portal (`/apply` public form calling admissions API) | MISSING | [Story](superpowers/specs/T1-03-public-applicant-portal.md) | [ADR-0041](adr/0041-public-applicant-portal-auth-boundary.md) | — | ☒ |
| T1-04 | ShepherdAI early-alert signal: GPA-drop detection, deployed to staff queue | PARTIAL | [Story](superpowers/specs/T1-04-gpa-drop-early-alert.md) | — | — | ☒ |
| T1-05 | Student self-service: transcript request submission (not read-only) | PARTIAL | [Story](superpowers/specs/T1-05-student-transcript-request.md) | — | — | ☒ |

### TIER 2 — Complete Core SIS Workflows
*Goal: End-to-end workflows from intake to transcript without staff manual workarounds.*
*Target: 60 days*

| # | Feature | Status | Story | ADR | Brief | Done |
|---|---------|--------|-------|-----|-------|------|
| T2-01 | Stripe payment collection (checkout, payment intent, webhook → ledger) | PARTIAL | [Story](superpowers/specs/T2-01-stripe-payment-collection.md) | [ADR-0042](adr/0042-stripe-payment-integration-pci-boundary.md) | — | ☒ |
| T2-02 | Application document checklist (upload, review, checklist enforcement) | PARTIAL | [Story](superpowers/specs/T2-02-application-document-checklist.md) | — | — | ☒ |
| T2-03 | Admin CRUD: course catalog create/edit/archive | PARTIAL | [Story](superpowers/specs/T2-03-admin-course-catalog-crud.md) | — | — | ☒ |
| T2-04 | Admin CRUD: section create/edit/assign instructor | PARTIAL | [Story](superpowers/specs/T2-04-section-create-assign-instructor.md) | — | — | ☒ |
| T2-05 | Admin CRUD: academic calendar create/edit terms and periods | PARTIAL | [Story](superpowers/specs/T2-05-academic-calendar-crud.md) | — | — | ☒ |
| T2-06 | GPA calculation engine: posted grades → student profile GPA | PARTIAL | [Story](superpowers/specs/T2-06-gpa-calculation-engine.md) | [ADR-0043](adr/0043-gpa-calculation-engine-grade-profile-linkage.md) | — | ☒ |
| T2-07 | Faculty: assignment creation UI and grade-per-assignment entry | PARTIAL | [Story](superpowers/specs/T2-07-faculty-assignment-creation.md) | — | — | ☒ |
| T2-08 | Transcript PDF generation: grade history → formatted PDF document | PARTIAL | [Story](superpowers/specs/T2-08-transcript-pdf-generation.md) | [ADR-0044](adr/0044-transcript-pdf-generation-strategy.md) | — | ☒ |
| T2-09 | Student self-registration: add/drop via PWA | PARTIAL | [Story](superpowers/specs/T2-09-student-self-registration.md) | — | — | ☒ |
| T2-10 | Attendance threshold enforcement + guardian absence notifications | PARTIAL | [Story](superpowers/specs/T2-10-attendance-enforcement-guardian-alerts.md) | — | — | ☒ |
| T2-11 | Student record editable fields: advisor notes, enrollment status changes, holds | PARTIAL | [Story](superpowers/specs/T2-11-student-record-editable-fields.md) | — | — | ☒ |

### TIER 3 — Achieve Competitive Differentiation
*Goal: Features no competitor has. The story we tell at every sales meeting.*
*Target: 90 days*

| # | Feature | Status | Story | ADR | Brief | Done |
|---|---------|--------|-------|-----|-------|------|
| T3-01 | Ministry Formation Records (faith journey, spiritual milestones, pastoral notes) | PARTIAL | [Story](superpowers/specs/T3-01-ministry-formation-records.md) | [ADR-0045](adr/0045-ministry-formation-records-model-privacy-boundary.md) | — | ☒ |
| T3-02 | Multi-institution type demo: Bible school + seminary + K–12 in one tenant group | DONE | — | — | — | ☒ |
| T3-03 | LMS live HTTP integration: real Moodle enrollment/launch/grade sync API calls | DONE | [Story](superpowers/specs/T3-02-lms-live-http-integration.md) | [ADR-0046](adr/0046-lms-http-client-implementation-retry-strategy.md) | — | ☒ |
| T3-04 | Guardian scoped access: attendance, grades, communications — real data boundaries | PARTIAL | [Story](superpowers/specs/T3-03-guardian-scoped-access.md) | — | — | ☒ |
| T3-05 | ShepherdAI: attendance pattern early-alert signal | PARTIAL | [Story](superpowers/specs/T3-04-shepherd-ai-attendance-pattern-alert.md) | — | — | ☒ |
| T3-06 | ShepherdAI: academic standing watchlist with configurable trigger thresholds | PARTIAL | [Story](superpowers/specs/T3-05-shepherd-ai-academic-standing-watchlist.md) | — | — | ☒ |
| T3-07 | Student PWA: full self-service (registration, transcript request, payment, aid) | DONE | [Story](superpowers/specs/T3-06-student-pwa-full-self-service.md) | — | — | ☒ |
| T3-08 | Financial aid award letter generation | PARTIAL | [Story](superpowers/specs/T3-07-financial-aid-award-letter.md) | — | — | ☒ |
| T3-09 | Tuition schedule engine: fee rules, payment plans, due-date automation | DONE | — | [ADR-0047](adr/0047-tuition-schedule-and-payment-plan-engine.md) | — | ☒ |
| T3-10 | Communications delivery automation (scheduled sends, triggered workflows) | DONE | — | — | — | ☒ |

### TIER 4 — Market Leadership
*Goal: Build the moat. Own the faith-based SIS category.*
*Target: 180 days*

| # | Feature | Status | Story | ADR | Brief | Done |
|---|---------|--------|-------|-----|-------|------|
| T4-01 | Denomination integration (church membership sync, ordination tracking) | DONE | — | — | — | ☒ |
| T4-02 | IPEDS/ATS certified compliance reporting | DONE | — | — | — | ☒ |
| T4-03 | Alumni CRM and giving module | DONE | — | — | — | ☒ |
| T4-04 | Accreditation documentation package generator | DONE | — | — | — | ☒ |
| T4-05 | Canvas live HTTP integration | DONE | — | [ADR-0046](adr/0046-lms-http-client-implementation-retry-strategy.md) | — | ☒ |
| T4-06 | Regulated federal financial aid activation | DONE | — | — | — | ☒ |
| T4-07 | Multi-campus / satellite-site support | DONE | — | — | — | ☒ |
| T4-08 | Applicant CRM: inquiry pipeline, drip sequences, conversion tracking | DONE | — | — | — | ☒ |
| T4-09 | Advanced ShepherdAI: retention risk scoring across cohorts | DONE | — | — | — | ☒ |
| T4-10 | Behavioral / conduct tracking and intervention records | DONE | — | — | — | ☒ |

---

## ADRs to Generate

The following architectural decisions must be recorded before implementation begins.
Agents must read existing ADRs 0001–0038 for format and context.

| ADR | Decision | Tier | Status |
|-----|----------|------|--------|
| ADR-0039 | ShepherdAI workflow action persistence strategy | T1-01 | ☒ DONE |
| ADR-0040 | Email delivery provider selection and queue worker | T1-02 | ☒ DONE |
| ADR-0041 | Public applicant portal auth boundary and spam controls | T1-03 | ☒ DONE |
| ADR-0042 | Stripe payment integration and PCI boundary | T2-01 | ☒ DONE |
| ADR-0043 | GPA calculation engine and grade-to-profile linkage | T2-06 | ☒ DONE |
| ADR-0044 | Transcript PDF generation strategy | T2-08 | ☒ DONE |
| ADR-0045 | Ministry Formation Records model and privacy boundary | T3-01 | ☒ DONE |
| ADR-0046 | LMS HTTP client implementation and retry strategy | T3-03 | ☒ DONE |
| ADR-0047 | Tuition schedule and payment plan engine | T3-09 | ☒ DONE |
| ADR-0048 | Application document checklist and admissions completion workflow | G-A6 | ☒ DONE |
| ADR-0049 | Student record editable fields and advisor notes audit model | G-A3 | ☒ DONE |
| ADR-0050 | Academic calendar admin CRUD with term-lock policy | G-A1 | ☒ DONE |
| ADR-0051 | Course catalog and section admin CRUD with archive policy | G-A2 | ☒ DONE |
| ADR-0052 | Student self-registration add/drop and enrollment window policy | G-B2 | ☒ DONE |
| ADR-0053 | Attendance threshold enforcement and guardian absence notification | G-A5 | ☒ DONE |
| ADR-0054 | Faculty assignment creation and per-assignment grade entry model | G-A4 | ☒ DONE |
| ADR-0055 | Student PWA full self-service scope and data boundary | G-C1 | ☒ DONE |
| ADR-0056 | Guardian PWA shell auth boundary and scoped portal policy | G-C2 | ☒ DONE |
| ADR-0057 | Financial aid award letter generation and regulatory boundary | G-B4 | ☒ DONE |
| ADR-0058 | Compliance and institutional reporting — IPEDS subset and scheduled delivery | G-C3 | ☒ DONE |

---

## PARTIAL Gap Closure Program

**Council Review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`
**Execution Prompts:** `docs/prompts/2026-06-25-partial-gap-closeout-prompts.md`
**Status:** ACTIVE — 13 PARTIAL domains → WORKING across 3 sprints

| ID | Domain | ADR | Sprint | Status |
| --- | --- | --- | --- | --- |
| G-A1 | Academic calendar admin CRUD | ADR-0050 | Sprint A | ☐ |
| G-A2 | Course catalog + section CRUD | ADR-0051 | Sprint A | ☐ |
| G-A3 | Student record editable fields + advisor notes | ADR-0049 | Sprint A | ☐ |
| G-A4 | Faculty assignment creation | ADR-0054 | Sprint A | ☐ |
| G-A5 | Attendance enforcement + guardian alerts | ADR-0053 | Sprint A | ☐ |
| G-A6 | Application document checklist | ADR-0048 | Sprint A | ☐ |
| G-B1 | Transcript PDF + grade history | ADR-0044 | Sprint B | ☐ |
| G-B2 | Student self-registration add/drop | ADR-0052 | Sprint B | ☐ |
| G-B3 | Stripe payment collection | ADR-0042 | Sprint B | ☐ |
| G-B4 | Financial aid award letter | ADR-0057 | Sprint B | ☐ |
| G-C1 | Student PWA full self-service | ADR-0055 | Sprint C | ☐ |
| G-C2 | Guardian PWA shell | ADR-0056 | Sprint C | ☐ |
| G-C3 | Compliance reporting IPEDS | ADR-0058 | Sprint C | ☐ |

---

## User Stories to Generate

One story per feature item above. Stories live in `docs/superpowers/specs/`.
Each story must include: acceptance criteria, edge cases, out-of-scope, role matrix.

All Tier 1 and Tier 2 stories must be written before any implementation begins.
Tier 3 and Tier 4 stories may be written in batches as tiers are entered.

---

## Implementation Queue

After all Tier 1 + Tier 2 assets (ADRs + stories + briefs) exist, run implementation
in the following sequence with maximum parallelism:

**Sprint 1 (parallel pair A + B):**
- A: T1-01 ShepherdAI persistence + T1-04 GPA-drop signal
- B: T1-02 Email delivery wiring

**Sprint 1 (parallel pair C):**
- C: T1-03 Public applicant portal

**Sprint 2 (parallel trio):**
- A: T2-01 Stripe integration
- B: T2-03 + T2-04 + T2-05 Admin CRUD (courses, sections, calendar)
- C: T2-06 GPA calculation engine + T2-07 Faculty assignment creation

**Sprint 3:**
- A: T2-08 Transcript PDF + T1-05 Student transcript request
- B: T2-09 Student self-registration + T2-11 Student record editable fields
- C: T2-10 Attendance enforcement + notifications

**Sprint 4 (Tier 3 begins):**
- A: T3-01 Ministry Formation Records
- B: T3-03 LMS HTTP integration
- C: T3-04 Guardian scoped access + T3-07 Student PWA self-service

---

## Progress Log

| Date | Event | Updated By |
|------|-------|------------|
| 2026-06-22 | Roadmap established by Council Review X | Ricardo Julia |
| 2026-06-22 | ADRs 0039–0047 written | Ricardo Julia |
| 2026-06-22 | Tier 1–3 user stories written (T1-01 through T3-07, 20 stories) | Ricardo Julia |
| 2026-06-22 | Sprint 1-A complete: T1-01 ShepherdAI persistence — dismiss note saved, snooze added, fetchSuggestions filters dismissed | Ricardo Julia |
| 2026-06-22 | Sprint 1-B complete: T1-02 Email delivery — Resend wired, Vercel Cron `/api/cron/email-worker`, idempotency + retry | Ricardo Julia |
| 2026-06-22 | Sprint 2-A complete: T1-03 Public applicant portal — `/apply` form, status token, rate limit, honeypot, staff queue wired | Ricardo Julia |
| 2026-06-22 | Sprint 2-B complete: T2-06 GPA engine + T1-04 GPA-drop signal — auto-GPA on grade post, ShepherdAI alert fires | Ricardo Julia |
| 2026-06-23 | Sprint 3-A complete: T2-01 Stripe — checkout session, webhook handler, PCI SAQ-A, idempotent ledger credit | Ricardo Julia |
| 2026-06-23 | Sprint 3-B complete: T2-03/04/05 admin CRUDs — course create/edit/archive, section+instructor, calendar year/term | Ricardo Julia |
| 2026-06-23 | Sprint 3-C complete: T1-05 student transcript request + T2-07 faculty assignment grid | Ricardo Julia |
| 2026-06-23 | Sprint 2 execution complete: T2-08 transcript PDF, T2-09 self-registration, T2-10 attendance enforcement, T2-11 student record editable fields | Ricardo Julia |
| 2026-06-23 | Sprint 3 execution complete: T2-02 document checklist, T3-01 ministry formation, T3-04 guardian scoped access, T3-05 ShepherdAI attendance, T3-06 watchlist, T3-07 student PWA self-service, T3-08 financial aid letter | Ricardo Julia |
| 2026-06-24 | Sprint 4 execution complete: T4-01–T4-10 all shipped (denomination, compliance, alumni, accreditation, Canvas HTTP, federal aid, multi-campus, applicant CRM, retention risk, conduct) | Ricardo Julia |
| 2026-06-25 | T4-05 Canvas live HTTP integration — executeCanvasProgressReturn added, LmsReviewedImportStatus bug fixed, ADR-0046 finalized. All roadmap items ☒. | Ricardo Julia |
| 2026-06-25 | Council Review X (partial gap closeout) — 8-voice + wildcard council evaluated 13 PARTIAL domains, unanimous ship. ADRs 0048–0058 written. 3-sprint parallelized execution plan in `docs/prompts/2026-06-25-partial-gap-closeout-prompts.md`. | Ricardo Julia |

---

## How Agents Must Update This Document

When any feature in the table above is completed and verified:
1. Change its `Done` checkbox from `☐` to `☒`
2. Add a row to the Progress Log with date and feature ID
3. Update `docs/project-status.md` to reflect the new state
4. Update CLAUDE.md if the architecture changes

No feature is "done" until: tests pass, lint passes, build passes, and the
feature can be demonstrated end-to-end in the dev environment.

---

## Authority

This document supersedes the feature ordering in `docs/project-status.md` and
`docs/product/factory-roadmap.md` for the duration of the competitive buildout.
The factory process in `docs/software-factory.md` still governs how each feature
is built. The competitive roadmap governs WHAT is built and in what order.

All sessions until this plan is complete must begin by reading this document.
