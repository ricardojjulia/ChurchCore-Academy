# Competitive Feature Closure Plan

Date: 2026-09-13
Status: Planned — each work package below must go through the software factory (intake → discovery → options → design spec → implementation plan → execution → verification → review → delivery) before code is written. This document is the intake/options-level brief the factory should start from; it is not itself an implementation plan.

## Why this document exists

Two prior artifacts drove this plan:

1. **The 2026-09-13 feature-by-feature competitive analysis** (chat-delivered, not yet a standing doc) found that `docs/product/sis-competitive-research-and-expansion-roadmap.md` understates ChurchCore Academy's actual position — 9 of its 10 listed "Tier 1/2 gaps" already have real backend implementations, just no admin UI. That correction is applied to this plan's sequencing (Section 2) and should be applied to the roadmap doc itself as a follow-up.
2. **The user's explicit build list**: every remaining Populi-parity gap, plus every planned differentiator, with 13 named features to plan in detail, plus the existing OneRoster certification-ready plan folded into the same queue.

## 1. Every feature Populi has that ChurchCore Academy does not

This is the complete Populi-parity gap list — confirmed absent from the codebase, not just "no UI yet":

| # | Feature | Populi has it | Academy status |
|---|---|---|---|
| 1 | Public applicant self-service portal (status tracking, document upload, no staff login) | Yes | Not built — admissions is admin/staff-facing only |
| 2 | Lead pipeline before "applicant" (inquiry → prospect → applicant stages) | Yes | Backend existed but was not surfaced: `Inquiry` (`src/modules/admissions/applicant-crm.ts`, `academy_inquiries`, statuses `new | contacted | nurturing | applied | enrolled | lost`, routes under `/api/academy/admissions/inquiries`) had no admin UI. *(Corrected 2026-09-23; the UI shipped in PR #135.)* |
| 3 | Bulk SMS/email campaigns to applicant/prospect lists | Yes | Not built — communications module sends individual, triggered messages only |
| 4 | Application fee collection | Yes | Not built — no fee line item tied to application submission |
| 5 | E-signature on enrollment agreements | Yes | Not built |
| 6 | Conditional application requirements (e.g., ordination letter for ministry programs) | Yes | Not built — document checklist is per document-type, not conditional on program/answers |
| 7 | FAFSA/ISIR import | Yes | Not built — federal-aid module records SAP/disbursement outcomes but does not ingest FAFSA/ISIR data |
| 8 | COD push-sync (submitting disbursement records to the Department of Education) | Yes | Not built — `recordFederalDisbursement`/`markDisbursementReported` are recording-only, no outbound COD transmission |
| 9 | Donor campaign management | Yes | Not built — alumni/giving module tracks individual gifts, not campaigns |
| 10 | Alumni directory (searchable, opt-in) | Yes | Not built — no directory UI or opt-in visibility model |
| 11 | Bookstore module | Yes | Not built, not planned — out of Academy's product boundary |
| 12 | Housing module | Yes | Not built, not planned — out of Academy's product boundary |
| 13 | Built-in LMS with native assignments/discussions/tests | Yes (Populi's own) | Deliberately not built — Academy's answer is a *better* architecture (provider-neutral LMS contract + first-party ChurchCore LMS), not a competing bundled LMS |
| 14 | Custom report builder (ad hoc filter/export) | Yes (though reviewers call it rigid) | Not built — reporting module has fixed CSV/IPEDS exports only |
| 15 | Multilingual student-facing UI | Weak in Populi too, but present | Not built at all in Academy |

Items 11–13 are deliberate non-goals (bookstore/housing are out of scope per the product boundary; the LMS decision is a strategic bet, not a gap). Items 1–10, 14, 15 are real parity gaps. Items 1–8 and 15 are addressed by name below. Items 9–10, 14 are not in this plan's scope — flagging them here so they aren't lost; they're smaller lifts once the alumni/reporting UI work (Section 2) happens.

## 2. Fast wins first: differentiators we already built and haven't shipped

Before any new backend work, close these — each is a UI-only or thin-integration lift on top of a complete, tested backend, and each is a feature **no competitor in the small-college/faith-based tier has at all**:

| Feature | Backend evidence | What's missing |
|---|---|---|
| ~~Ministry formation records (practicum, faith milestones, formation evaluations, endorsement)~~ | `src/modules/ministry-formation/service.ts`, full test coverage, API routes live | **Built and working, corrected 2026-09-15.** Admin UI (`/admin/formation`, `/admin/formation/[studentId]`), student dashboard (`/student/formation`), and role-gated formation-advisor assignment (`canAssignAdvisor`) all exist and were browser-verified logged in as the demo admin. Graduation-readiness integration checked against code 2026-09-23: `/admin/graduation` shows a capability-gated formation-complete badge, and by design formation does not feed `graduationReady`/`graduationBlocked` (ministry-formation acceptance criterion 16). Not re-checked in the browser. |
| ~~Denomination & ordination tracking~~ | `src/modules/people/denomination.ts`, full test coverage, API routes live | **Built and working, shipped 2026-09-15 (PR #114).** Admin UI (`/admin/denomination`, `/admin/denomination/[personId]`) and a capability-gated summary tab on the student/staff detail pages all exist and were browser-verified against real Postgres. Along the way, real bugs were found and fixed in the "already fully tested" backend module itself (row-to-type field mapping never actually converted snake_case to camelCase; the roster query missed people with only an ordination record and duplicated people with multiple memberships; all API routes were missing the capability check required by ADR-0061; the detail-page tab leaked religious-affiliation data to roles the module itself doesn't grant read access to). |
| ~~Alumni & giving~~ | `src/modules/people/alumni.ts`, full test coverage, API routes live | **Built and working, shipped 2026-09-15 (PR #116).** Admin UI (`/admin/alumni`, `/admin/alumni/[personId]`) and a capability-gated summary tab on the student detail page (graduated students only, never staff) exist and were browser-verified against real Postgres. Campaign layer shipped scoped down to filtering by the existing free-text `fund_designation` field, as planned — no first-class campaign entity was built. This module had the most serious bug found in the whole closure-plan effort so far: `academy_alumni_records`/`academy_giving_records` were created with `uuid` id columns, but this application's tenant/person ids are plain text — every query failed outright against a real database, invisible to the module's mock-only test suite. Fixed with a new forward migration (tables were still empty). Also found: no write-path check that a person is actually a graduated student before creating an alumni record, and no UI path existed to create the *first* alumni record for a newly-graduated student at all. |
| ~~Competency/narrative evaluation~~ | `EvaluationType`, `CompetencyPolicy`, `NarrativePolicy` in `grading-records/types.ts` | **Built and working, shipped 2026-09-15 (PR #117).** Unlike the three prior rows, this one's backend was NOT "fully built, just missing UI" — `grading-records` had only a single read method and no write path at all before this PR. Added 12 repository write methods, 8 API routes, and turned `/admin/settings/grading` from read-only into a builder (create/edit/delete for evaluation scales, scale bands, rule sets, official record rules), gated by a new `competencyNarrativeGrading` capability (`bible_school`/`seminary`). Competency transcript format (student-level competency assessment/progress records) was explicitly out of scope for this pass and remains a real gap — see Section 3 note below. Found and fixed after the builder agents reported success: no default on the tables' `id` columns (client would have had to generate ids itself); a blocked-delete case that returned a raw 500 instead of the intended 400; a fake test file that never actually invoked the route handlers it claimed to test; scale bands with no edit/delete UI at all; a free-text "Course ID" field that needed the course's internal id but showed a human-readable-code placeholder; the RLS write policy for these four tables restricted writes to `institution_admin` only, so the approved `academic_admin` write access would have passed the app-layer check and failed at the database layer; single-column foreign keys that let a cross-tenant scale/course/section id be referenced; three edit forms that let an admin change fields the PATCH routes silently ignored; missing runtime validation on required string/boolean fields; icon-only buttons with no accessible name; and a test named "cross-tenant rejection" that never actually tested a cross-tenant scenario. |
| ~~Academic standing automation~~ | `academic-standing-evaluator.ts` | **Built and working, shipped 2026-09-16 (PR #121).** A genuinely deeper gap than the four prior rows: the evaluator had never been wired to any real data at all. It expects grade data tied to the rule-set system built for competency/narrative grading (PR #117), which has zero real rows anywhere. Rather than ship that unwired, built a documented, best-effort adapter (`loadOfficialRecordEntriesFromTranscript`) from the real, already-posted grades in `academy_transcript_entries` — disclosed approximation: that table has no clock-hour columns, so a clock-hour-based standing rule will always report a blocker through this adapter. Added a new append-only `academy_standing_evaluations` table (with the same immutability trigger pattern as transcript entries), a new `academicStandingAutomation` capability (`college`/`seminary`/`university`), and an "Academic Standing" tab on the student detail page: manual evaluation, history, and a reviewed workflow that recommends creating/clearing an academic hold — but never auto-applies one, always a separate explicit action. SAP integration and any automatic/scheduled re-evaluation were explicitly out of scope for this pass, confirmed by the user before work began. Found and fixed after the builder agents reported success: the evaluator input was silently hardcoded to always be empty (would have made every evaluation meaningless); the frontend assumed a `{ holds: [...] }` response shape that didn't match the actual route (crashed the whole tab); a logic gap where a student with both a positive and a blocking standing type simultaneously could get a wrong "clear this hold" recommendation while still actually blocked; a pagination test that would have passed even with LIMIT/OFFSET completely broken; and no database-level immutability on the new audit table despite the PR describing it as append-only. |

**Recommendation: sequence a "Surface the Built Differentiators" work package before the net-new features in Section 3.** It's the cheapest, fastest path to a materially stronger competitive story, and it should go through the factory first. **Updated 2026-09-16: this entire work package is now done** — ministry formation, denomination/ordination, alumni/giving, competency/narrative evaluation, and academic standing automation have all shipped, apart from the competency transcript gap carried over in the Section 3 note. The next queued item is Admissions CRM Completion (Section 3.1).

**Addendum (2026-09-16, daily checkup):** the four shipped pages above (`/admin/formation`, `/admin/denomination`, `/admin/alumni`, `/admin/settings/grading`) worked correctly when loaded directly, but none had ever been added to the sidebar nav — reachable only by typing the exact URL, which nobody navigating the app normally would do. Fixed in PR #119: added nav entries for all three still missing one (formation already had one), denomination and alumni each gated by the same capability + role check the destination page itself enforces. *(Correction 2026-09-23: grading was an exception. It was shown to every staff role, although `/admin/settings/grading` only allows institution_admin, dean, registrar and academic_admin. The same was true of the rest of the System section. Fixed in the 2026-09-23 System nav role-gating PR.)* The first version of that fix only checked capability, not role, which would have shown the new links to staff roles who'd then hit an access-denied page on click — caught and fixed via PR review before merge, not after.

**A pattern worth naming, observed on every item shipped so far:** each "fully tested" backend module in this package has turned out to have real, previously-undiscovered bugs that only surfaced once wired to a UI and tested live against real Postgres — never caught by the existing mock-DB unit tests, because those mocks hand back pre-shaped, already-correct fixtures instead of what the database actually returns (raw `Date` objects for `date`/`timestamptz` columns, snake_case column names, stale capability snapshots). Budget time for this on the remaining items rather than treating "full test coverage" in the evidence column as proof the backend is actually correct.

**Correction note (2026-09-15):** this table's ministry-formation row was wrong when written — the admin UI, student dashboard, and advisor assignment it listed as "missing" already existed in the codebase on 2026-09-13 (or shipped very shortly after) and were not checked before writing "what's missing." This is the same doc-drift pattern flagged in `docs/product/product-context.md`'s "Current Honest State" history and the [[project_feature_audit_2026_09_12]] memory: verify against running code/browser before asserting a feature's UI status, don't infer it from the backend module list alone.

## 3. Detailed work packages for the 13 requested features

Grouped into 7 initiatives by shared data surface. Each follows this repo's established module shape (`types.ts` + `service.ts` + `postgres-repository.ts` + `__tests__/` + API route(s) + admin/student UI), per CLAUDE.md's architecture rules.

**Open gap carried over from Section 2: competency transcript format.** The competency/narrative evaluation work (PR #117) shipped the grading configuration builder but left out student-level competency assessment and progress records, and a transcript format that renders them. Until that is built, a `bible_school`/`seminary` institution can configure competency scales but cannot record or print a competency-based transcript. It is not yet assigned to one of the initiatives below; scope it as its own work package when it is queued.

---

### 3.1 Admissions CRM Completion
*Covers: public applicant self-service portal, lead pipeline, bulk SMS/email, application fee collection, e-signature, conditional requirements*

> **Status and corrections (2026-09-23).** Most of this package has since shipped, and several of the design points below were wrong about the existing code. Read them as the original proposal, not as a spec:
> - **Lead pipeline:** there was no new `AdmissionInquiry` entity. PR #135 built the admin UI on the existing `Inquiry` model and its status vocabulary (`new | contacted | nurturing | applied | enrolled | lost`), which avoided duplicate lead records and a second state machine.
> - **Application fees:** not a thin `billing` wrapper. `createPaymentIntent` needs a `studentPersonId` and `academicPeriodId` that a pre-enrollment applicant doesn't have, and `BillingSourceType` had no admissions source. PR #156 shipped a dedicated `academy_application_fee_charges` flow with its own applicant ownership, webhook reconciliation, and waiver path.
> - **E-signature:** shipped in PR #157.
> - **SMS:** the communications contract supports only `in_app` and `email` (`CommunicationChannel`), with no SMS channel or provider boundary. Any `sms | both` campaign channel needs its own contract, provider, consent and retry design first. Until then, campaigns are email-only.
> - **Public-route security baseline:** the existing public routes are not a safe template. `/api/academy/admissions/inquiries` accepted anonymous writes under a caller-supplied `X-Tenant-Id` header (removed in PR #159; the route is now staff-only). `/api/public/apply/*` resolve the tenant from a query parameter or environment default. The status lookup has no rate limit; its token is a random UUID, so it can't practically be enumerated, but throttling would still add defense in depth. Any new public endpoint needs trusted institution resolution and throttling for both writes and lookups, and its security tests must also cover the existing public routes.

**Why grouped:** all six extend the existing `src/modules/admissions/` module and its `AdmissionApplication` state machine (`draft → submitted → under_review → accepted/declined → withdrawn`). Splitting them into separate work packages would mean touching the same files six times.

**Data model additions:**
- New `AdmissionInquiry` entity (pre-application): `id`, `tenantId`, `programId?`, `contactName`, `contactEmail`, `contactPhone`, `stage` (`inquiry | nurturing | applicant | accepted | enrolled | lost`), `source`, `assignedStaffPersonId?`, `createdAt`, timestamps. An `AdmissionApplication` links back to the `AdmissionInquiry` that spawned it (nullable — direct applications remain valid).
- `ApplicationFeeCharge`: `applicationId`, `amountCents`, `status` (`pending | paid | waived`), `paidAt?`, `paymentIntentId?` — reuses the existing `billing` module's payment-intent machinery rather than inventing a second payment path.
- `EnrollmentAgreementSignature`: `applicationId`, `signedByPersonId`, `signedAt`, `documentHash`, `ipAddress` (redacted in audit per existing secret-redaction convention), `status` (`pending | signed | declined`).
- `DocumentRequirementRule`: extends the existing `DocumentType` concept with a condition expression (`programId IN (...)` or an answer-key match, e.g. `intendedTrack = 'ministry'` requires an ordination-letter document type). Keep this a small rule engine, not a general workflow engine — matches CLAUDE.md's "start simple" principle.
- `CommunicationCampaign`: `tenantId`, `name`, `audienceQuery` (structured filter over inquiries/applications, not free SQL), `channel` (`email | sms | both`), `templateKey`, `sentAt?`, `sentCount`. Sends fan out through the *existing* `communications` module's queue/provider boundary — this package does not add a second email/SMS pipeline.

**Service/API surface:**
- `src/modules/admissions/inquiry-service.ts` — create/update/convert-to-application, stage transitions with audit events (mirrors `AdmissionsService`'s existing event-recording pattern).
- `src/modules/admissions/fee-service.ts` — thin wrapper delegating to `billing`'s payment-intent creation, tagged with `sourceType: "admissions_fee"`.
- `src/modules/admissions/agreement-service.ts` — signature capture + hash verification. No third-party e-signature vendor dependency in v1 (click-to-sign with recorded hash/timestamp is legally sufficient for most enrollment agreements; escalate to DocuSign/HelloSign integration only if a specific institution's counsel requires it — flag as an open question for the design-spec stage).
- New public routes under `src/app/api/public/admissions/` (inquiry submission, application status lookup by token) — **must not** reuse the authenticated `academy-database-context` pattern as-is; needs its own rate-limited, unauthenticated-safe boundary matching the existing `/api/public/apply/*` routes already in the codebase.
- New public pages: `src/app/apply/inquiry/`, extend the existing `src/app/apply/status/` for real-time pipeline visibility.
- New admin pages: `/admin/admissions/pipeline` (kanban-style stage board), `/admin/admissions/campaigns`.

**ShepherdAI angle (already named in the roadmap, now concrete):** a signal for "inquiry aging beyond N days without stage progression" and "application accepted but agreement unsigned after N days" — both fit the existing deterministic-threshold pattern in `signal-aggregator.ts`.

**Dependencies:** billing module (fee collection), communications module (bulk send), existing admissions module (everything else). No new external services required for v1 e-signature.

**Test plan:** success/rejection/cross-tenant for every new service function per CLAUDE.md convention; a public-route test suite specifically proving unauthenticated inquiry/status endpoints cannot leak cross-tenant or cross-applicant data (this is the highest-risk surface in this package — it's the first genuinely public-write endpoint pattern change).

**Priority:** Highest of the net-new work — this closes the largest number of named Populi-parity gaps (6 of 15) in one coherent package.

---

### 3.2 Federal Aid Integration
*Covers: FAFSA/ISIR import, COD push-sync*

**Data model additions:**
- `IsirRecord`: raw-import staging table keyed by `studentPersonId`/`awardYear`, storing the FAFSA-derived fields the institution actually uses (EFC/SAI, dependency status, Pell eligibility flag, verification-selected flag) — **not** a full ISIR field dump; scope to what `AidPackage`/`AidAward` actually consume.
- `CodTransmissionBatch`: `tenantId`, `awardYear`, `status` (`built | submitted | accepted | rejected`), `recordCount`, `submittedAt?`, `responseReceivedAt?` — extends the existing `FederalDisbursementReport` status machine (`pending/reported/accepted/rejected`) rather than replacing it.

**Service/API surface:**
- `src/modules/financial-aid/isir-import.ts` — parses an ED-format ISIR file (fixed-width or the newer XML format; design-spec stage must pick one based on which format target institutions actually receive from FSA) and maps into `IsirRecord`, then into aid-package eligibility inputs.
- `src/modules/financial-aid/cod-transmission.ts` — builds a COD-formatted batch from `FederalDisbursementReport` rows marked `reported`, and exposes a transmission boundary. **This must be scoped as a real external-gate item, not a code-complete claim** — actual submission to FSA's COD system requires an institution-specific SAIG mailbox connection, which is exactly the kind of "external release gate" this repo's `project-status.md` already tracks for LMS/payment providers. The code should get to "generates a valid COD-format batch file, ready for SAIG transmission" — actual network transmission to FSA is a provider-activation-style follow-on, not part of this package.

**Priority:** High for institutions with Title IV eligibility, but genuinely gated by SAIG enrollment (an institution-level federal credentialing process outside this codebase's control) — sequence the import/batch-generation half now, treat live COD transmission the same way Moodle/Canvas activation is treated (built, gated, evidenced before going live).

---

### 3.3 Church-Partner Scoped Access
*Covers: church-partner scoped access / sponsorship / placement coordination*

**Builds directly on** `src/modules/people/denomination.ts`'s existing `DenominationMembershipRecord`.

**Data model additions:**
- `ChurchPartnerProfile`: `tenantId`, `churchName`, `denominationAffiliation?`, `contactPersonId?` (an `AcademyActor` if the church has a portal login, otherwise contact fields only), `status` (`active | inactive`).
- `ChurchSponsorship`: links `ChurchPartnerProfile` to a `studentPersonId`, with `sponsorshipType` (`financial | endorsement | both`), `startsOn`, `endsOn?`. Financial sponsorships should reference `AidAward` where `sourceType = "church"` (already exists) rather than duplicating award tracking.
- `MinistryPlacement`: `studentPersonId`, `churchPartnerId`, `placementType` (`practicum | internship | post-graduation_call`), `startsOn`, `endsOn?`, `status`. This is the natural integration point with `ministry-formation`'s `PracticumSession` — a placement record can be the "site" a practicum session references.

**New role/access model:** a new, narrowly-scoped `AcademyRole` value — `"church_partner"` — whose `canAccessPeopleDomain`-equivalent policy grants read-only access to exactly the sponsored/placed students' basic progress (enrollment status, formation milestones marked "shareable", GPA band not exact GPA) and nothing else. This is a genuinely new access-boundary shape (an external, non-institution-employee role with cross-tenant-adjacent semantics if a church sponsors students across multiple partner institutions) — **this needs its own design-spec pass on tenant isolation before implementation**, since every other role in this system is tenant-internal.

**Priority:** Medium — high differentiation value, but the new access-boundary shape is nontrivial enough that it shouldn't be rushed; recommend this run *after* 3.1 so the team isn't introducing two new security boundaries (public admissions routes + external church-partner role) in the same cycle.

---

### 3.4 Academic Delivery Flexibility
*Covers: modular/block scheduling, clock-hour accumulation, hybrid delivery tracking*

**Builds on** `course-catalog`'s existing `durationUnit`/`creditHours`/`clockHours` fields and `student-groups`' cohort model.

**Data model additions:**
- `SectionDeliveryMode`: extend `CourseSection` with `deliveryMode` (`in_person | online_async | online_sync | hybrid_block`) and, for block/modular sections, a `blockStartsOn`/`blockEndsOn` pair distinct from the parent Academic Period's dates (a section can run a 6-week block inside a 16-week term).
- `ClockHourLedger`: per-`enrollment`, an accumulating record of clock hours earned per session/meeting, distinct from the static `clockHours` field already on the course (which is the *target*, not the *accumulated actual*). This is the piece genuinely missing — Bible-school clock-hour programs need "the student has attended 340 of 360 required hours," not just a course-level target.
- Cohort-level graduation requirements: add an optional `requiredCompletionCriteria` reference from `StudentGroup` to a `ProgramCurriculum` version, so a cohort's expected pace can be evaluated as a unit (feeds the roadmap's "cohort health score" ShepherdAI idea later, out of scope for this package).

**Priority:** Medium-high for Bible-school-mode institutions specifically (this is the segment where clock-hour accumulation is a hard requirement, not a nice-to-have) — sequence based on which institution type is actually onboarding next.

---

### 3.5 Multilingual / International Student Support

**Confirmed fully absent** — no i18n scaffolding exists anywhere in the codebase today, which makes this the largest lift per unit of feature value in this entire plan. Recommend treating it as two separable pieces rather than one package:

**Piece A — Student-facing localization infrastructure:** requires a genuine i18n framework decision (`next-intl` is the natural fit for a Next.js App Router codebase; this is a real "adding a stack" decision under CLAUDE.md Rule 5 and needs its own documented choice: runtime/framework, deployment impact, and how it interacts with Student PWA offline caching). Scope to the Student PWA and public applicant portal first — not the admin surfaces, which can stay English-only far longer since staff are institution employees.

**Piece B — International-student data model:** `StudentInternationalProfile` (visa status, program start/end for SEVIS-relevant date tracking, ESL indicator), a document-checklist extension for visa/immigration documents (reuses the admissions `DocumentType` conditional-requirement engine from 3.1 — another reason to sequence 3.1 first), and currency display (not currency *processing* — Stripe already handles multi-currency charging; this is a formatting concern only).

**Priority:** Lower than the other packages despite roadmap emphasis — it's real differentiation for the "international missions training" segment specifically, but it's the most expensive package here and serves the smallest named segment. Recommend it after 3.1–3.4 unless a specific pending institution deal depends on it.

---

### 3.6 ShepherdAI Advising Workflow Intelligence
*Covers: advising case queues, caseload balance*

**Builds on** the existing `shepherd-ai`/`academic-workflows` signal-and-workflow infrastructure — this is additive to the signal engine, not a new subsystem.

**Data model additions:**
- `AdvisorCaseload`: derived view, not a stored table — `StudentProfile.advisorPersonId` (the existing academic-advisor assignment; `StudentProgramMembership` has no `advisorId`, and `StaffProfile.primaryRole` is a single role, not a set of capacities) grouped by advisor, with eligible advisors defined as staff holding the `advisor` role or referenced by at least one `advisorPersonId`, counted and weighted by open `ShepherdAiSuggestion` severity.
- `AdvisingCaseQueueEntry`: a read-model surface (not a new write path) that ranks a given advisor's assigned students by open-signal severity — reuses `ShepherdAiSuggestion`'s existing `urgency`/`confidence` fields rather than inventing a parallel scoring system.

**Service/API surface:** a new query function in `academic-workflows` — `getAdvisorCaseQueue(actor, advisorPersonId)` — and a UI surface for advisors (extends the faculty portal's existing `/faculty/shepherd` page rather than creating a new route tree).

**Explicit non-goal, now planned separately:** "draft advising communication templates generated from student record context" (named in the original roadmap) is an LLM-adjacent feature and must go through the same Rule 3 framing as any ShepherdAI wording-assistance feature — suggestion-only, human-reviewed, no autonomous send. It's out of scope for this package; it's now covered by `docs/adr/0070-shared-openrouter-llm-gateway.md` and `docs/superpowers/plans/2026-09-13-openrouter-ai-gateway-plan.md` as the `advising_followup_draft` task type — build the gateway first, then this becomes a thin addition on top of it, not new infrastructure.

**Priority:** Medium — genuinely differentiated (no competitor has this), moderate lift since it's mostly a read-model over data that already exists.

---

### 3.7 ShepherdAI Faculty Load & Qualification-Match Intelligence

**Builds on** `StaffProfile.loadPolicy` (already exists as a field, currently unused) and course/section instructor assignment.

**Data model additions:**
- `FacultyQualification`: `staffPersonId`, `qualificationType` (`degree | ordination_credential | subject_certification`), `subjectAreaTags[]`, `expiresOn?` — reuses the ordination-credential shape already established in `denomination.ts`'s `OrdinationRecord` for the ordination case, adds a lighter academic-credential record for the rest.
- A deterministic signal: "section assigned to instructor whose qualification tags don't match the course's subject area" and "instructor teaching-load hours exceed `loadPolicy` threshold" — both fit the existing `signal-aggregator.ts` pattern exactly.

**Priority:** Lower — valuable for ATS faculty-ratio compliance specifically, but a smaller and less urgent audience than the admissions/aid work.

---

## 4. OneRoster Certification-Ready Compliance

The existing plan at `docs/superpowers/plans/2026-09-12-oneroster-certification-ready-compliance-plan.md` is adopted into this queue as-is — it already carries full council-decision framing, a cross-repo implementation plan (Academy as Rostering Provider + Gradebook Consumer, LMS as Rostering Consumer + Gradebook Provider), a test plan, and acceptance criteria. Two notes for sequencing here rather than duplicating its content:

- **Its Academy-side work is a clean-PR redo of the reverted `feat/shared-oneroster-standard` work** (see `docs/integrations/oneroster-decision-history.md` for why it was reverted — a workspace mixup, not a design rejection). The reverted code at commit `94dfdde` is a legitimate starting reference for the Academy Rostering Provider piece, not a rejected design.
- **Sequence it independently of Sections 1–3.** It touches `lms-contract` and a new `oneroster-contract`-equivalent module, not admissions/aid/denomination/course-catalog, so it can run in parallel with any of the above without file-level collision. The one shared touchpoint is `communications`/`billing` are untouched by it — no coordination needed.

## 5. Recommended factory queue order

Supersedes the "Next Factory Work Packages" list in `docs/product/sis-competitive-research-and-expansion-roadmap.md` Section 7:

1. **Surface the Built Differentiators** (Section 2 above) — admin UI for ministry formation, denomination/ordination, alumni/giving, competency evaluation. Cheapest, fastest, closes zero-competitor-has-this gaps.
2. **Admissions CRM Completion** (3.1) — closes 6 of 15 Populi-parity gaps in one package.
3. **OneRoster Certification-Ready Compliance** (Section 4) — run in parallel with #2; no file overlap.
4. **Church-Partner Scoped Access** (3.3) — after #2, so the team isn't opening two new external-facing security boundaries at once.
5. **Academic Delivery Flexibility** (3.4) — prioritize sooner if a Bible-school-mode institution is actively onboarding.
6. **ShepherdAI Advising Workflow Intelligence** (3.6) — moderate lift, reuses existing signal infrastructure.
7. **Federal Aid Integration** (3.2) — sequence the import/COD-batch-generation half; treat live FSA transmission as an external release gate like LMS/payment activation.
8. **ShepherdAI Faculty Load Intelligence** (3.7).
9. **Multilingual / International Student Support** (3.5) — largest lift, smallest named segment; pull forward only if a specific deal requires it.

Each item still needs its own intake → discovery → options → design spec → implementation plan cycle before code — this document is the options-level input to that process, not a substitute for it.
