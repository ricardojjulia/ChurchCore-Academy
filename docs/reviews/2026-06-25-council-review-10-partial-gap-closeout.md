# Council Review X — PARTIAL Gap Closeout Evaluation

Date: 2026-06-25
Governing context: `docs/competitive-roadmap.md` (Honest State table, June 2026)
Decision: **ship this plan** — unanimous

---

## Purpose

The competitive roadmap reached 100% on June 25, 2026. All four tiers are marked ☒. However, the Honest
State table in that roadmap records 13 domains as **PARTIAL** — designed and partially wired, but not yet
delivering the full running workflow. This review evaluates each PARTIAL item, produces the ADR and
execution-prompt assignments needed, and approves a three-sprint parallelized closeout plan.

---

## PARTIAL Items Under Evaluation

| # | Domain | Gap |
|---|--------|-----|
| 1 | Admissions | Application document checklist not implemented |
| 2 | Student records | Editable fields and advisor notes missing |
| 3 | Academic calendar | Admin CRUD (create/edit terms and periods) missing |
| 4 | Course catalog | Create/edit/archive forms missing |
| 5 | Enrollment/registration | Student self-registration (add/drop) missing |
| 6 | Attendance | Threshold enforcement and guardian absence alerts missing |
| 7 | Gradebook | Assignment creation and per-assignment grade entry missing |
| 8 | Transcripts | PDF generation and grade-history assembly missing |
| 9 | Student PWA | Read-only — self-service transactions missing |
| 10 | Guardian portal | No guardian PWA shell |
| 11 | Billing | Stripe payment checkout not wired |
| 12 | Financial aid | Award letter generation missing |
| 13 | Reporting | No IPEDS output, no scheduled delivery |

---

## Council Role Opinions

### Product Manager

The 13 PARTIAL items are not independent gaps — they form a dependency chain. A student cannot
self-register if the course catalog has no admin CRUD. A student cannot pay if Stripe is not wired.
The PWA is read-only until all upstream data-entry and transaction surfaces exist. My priority order:

**Wave 1 (unblocked):** calendar CRUD, course CRUD, student record edits, faculty assignments,
attendance enforcement, document checklist.
**Wave 2 (depends on Wave 1):** student self-registration, transcript PDF, Stripe payment, financial
aid letter.
**Wave 3 (depends on Wave 2):** student PWA full self-service, guardian PWA shell, compliance reporting.

The institution cannot demo the product end-to-end until Wave 1 is shipped. Every week of delay on
Wave 1 delays the pilot by a week. This is the critical path. Vote: **ship this plan immediately**.

### Domain Architect

Eleven new ADRs are needed. Two features (Stripe billing, transcript PDF) already have ADRs (0042 and
0044 respectively) and need only implementation prompts. The remaining eleven require durable decisions
about data models, role access policies, and term-lock behavior before code is written.

Boundary concern: student self-registration, PWA self-service, and guardian portal all touch the same
student-record and enrollment modules. The backend must be built before either PWA surface is built.
The backend-builder must be invoked before the frontend-builder in all three cases.

No PARTIAL item crosses the Academy/LMS boundary. All thirteen are SIS-internal. Vote: **ship this plan**.

### Data Modeler

Wave 1 adds or extends the following tables:
- `academy_application_documents` (T2-02, new)
- Edit columns on `academy_students` + new `academy_advisor_notes` (T2-11, new table)
- No new tables for calendar CRUD — the schema exists, just needs admin routes
- No new tables for course catalog CRUD — same
- `academy_assignments` + `academy_assignment_submissions` (T2-07, new)
- No new tables for attendance enforcement — service-level change only

Wave 2:
- No new tables for transcript PDF — reads existing records
- No new tables for student self-registration — calls existing enrollment service
- `academy_tuition_schedules`, `academy_payment_plans`, `academy_payment_plan_installments` (T2-01, ADR-0042/0047 already decided)
- `academy_aid_letters` (T3-07/08, new)

Wave 3:
- No new tables for PWA self-service — consumes existing APIs
- No new tables for guardian PWA — guardian-student relationships already exist
- `academy_scheduled_reports` (T4-02, new)

All new tables are tenant-scoped with RLS. Migrations are append-only. Wave 1 migrations must land
before Wave 2 builds begin. Vote: **ship this plan**.

### Backend Builder

Sprint A parallelizes 6 independent feature-factory runs. Sprint B parallelizes 4. Sprint C parallelizes 3.
Total: 13 feature deliveries across 3 sprints. Each sprint ends with `npm test && npm run lint && npm run build`.

Dependencies to enforce:
- Sprint B Prompt B-2 (student self-registration) must import the course catalog service completed in Sprint A.
- Sprint C Prompt C-1 (PWA self-service) must call the Stripe service from Sprint B.
- Sprint C Prompt C-2 (guardian PWA) must call the student records service from Sprint A.

No cross-sprint circular dependencies. The plan is safe to execute. Vote: **ship this plan**.

### Frontend / PWA Builder

The student PWA is the most visible surface. It becomes useful only after Wave 2 is complete. The
guardian PWA has no shell at all — it needs to be built from scratch in Sprint C.

UI priority within each sprint:
- Sprint A: admin-facing CRUD forms (high surface area, straightforward Mantine table + modal pattern)
- Sprint B: faculty/student-facing transaction flows (grade entry, transcript request, payment intent)
- Sprint C: student PWA self-service and guardian shell (most user-facing, most polish needed)

All UI work must pass a visual check before the sprint is considered done. Vote: **ship this plan**.

### Security and Privacy Reviewer

Risk inventory by sprint:

**Sprint A risks:**
- Advisor notes: must be role-gated (advisor and registrar only); students must not read their own notes
- Document uploads: Supabase Storage bucket must be private, tenant-scoped paths, no public URLs
- Editable fields: every edit must emit an immutable audit event (ADR-0019 pattern)

**Sprint B risks:**
- Transcript PDF: must not leak grade data from other tenants; PDF generation is synchronous — avoid timeout on large transcripts
- Stripe: PCI SAQ-A boundary (ADR-0042); webhook secret must be verified before any ledger credit
- Financial aid letter: student acceptance IP must be hashed, not stored raw

**Sprint C risks:**
- Guardian portal: guardian can only see their linked students; FERPA must gate Ministry Formation Records from guardian view
- PWA self-service: self-registration must enforce enrollment window dates; past-deadline drop must route to registrar

Each ADR must include a security/privacy review note. Vote: **ship this plan with these enforcements**.

### Release Validator

The definition of "nothing is PARTIAL" is:
1. Every domain in the Honest State table reads **WORKING** in running code
2. `npm test` covers every new service function (success, rejection, cross-tenant cases)
3. `npm run lint` and `npm run build` pass clean
4. Each sprint ends with a PR through CI before the next sprint begins
5. The competitive-roadmap.md Honest State table is updated after each sprint's PR merges

This council review, the 11 ADRs, and the prompts file together constitute the release gate definition
for the PARTIAL gap closeout program. Vote: **ship this plan**.

### Wildcard

Four things this plan could get wrong:

1. **Sequential PR gate is slower than it looks.** Three sprints × CI per sprint = 3 PR cycles. If CI
   takes 5 minutes and a sprint takes a day, that is fine. If a sprint build breaks, the next sprint
   is blocked. Each sprint's builder agents must run `npm test && npm run lint && npm run build` before
   declaring done — not after. The prompts must enforce this.

2. **Faculty assignment creation is a hidden dependency for GPA.** The GPA engine (ADR-0043) computes
   GPA from posted grades. If assignment grading replaces the current direct grade-entry path, the GPA
   recalculation trigger must fire from the new submission path, not just the old one. The T2-07 builder
   must verify the GPA recalculation fires on assignment grade post.

3. **Reporting (T4-02 IPEDS) is underspecified.** There is a design spec (`2026-06-21-reporting-exports-design.md`)
   but IPEDS field definitions require institution-specific data (UNITID, program CIP codes, etc.) that
   we do not yet collect. ADR-0058 must scope IPEDS to a best-effort subset and call out what is blocked
   on institution data configuration. Do not promise IPEDS certification from Sprint C.

4. **Guardian portal guardian-student relationship table.** This table exists but may not have RLS that
   prevents a guardian from querying another guardian's students via a crafted API call. The guardian-portal
   backend in Sprint C must enforce: `guardian_id = auth.uid()` in every query, not just presence in the
   relationship table.

Vote: **ship this plan with wildcard conditions applied to Prompts A-4, C-2, and C-3**.

---

## ADR Assignments

| ADR | Title | Story | Sprint |
|-----|-------|-------|--------|
| ADR-0048 | Application document checklist and admissions completion workflow | T2-02 | A-6 |
| ADR-0049 | Student record editable fields and advisor notes audit model | T2-11 | A-3 |
| ADR-0050 | Academic calendar admin CRUD with term-lock policy | T2-05 | A-1 |
| ADR-0051 | Course catalog and section admin CRUD with archive policy | T2-03 / T2-04 | A-2 |
| ADR-0052 | Student self-registration add/drop and enrollment window policy | T2-09 | B-2 |
| ADR-0053 | Attendance threshold enforcement and guardian absence notification | T2-10 | A-5 |
| ADR-0054 | Faculty assignment creation and per-assignment grade entry model | T2-07 | A-4 |
| ADR-0055 | Student PWA full self-service scope and data boundary | T3-06 | C-1 |
| ADR-0056 | Guardian PWA shell auth boundary and scoped portal policy | T3-03 | C-2 |
| ADR-0057 | Financial aid award letter generation and regulatory boundary | T3-07 / T3-08 | B-4 |
| ADR-0058 | Compliance and institutional reporting — IPEDS subset and scheduled delivery | T4-02 | C-3 |

Implementation-only (ADR already exists):
- T2-01 Stripe payment → ADR-0042 (Sprint B-3)
- T2-08 Transcript PDF → ADR-0044 (Sprint B-1)

---

## Sprint Execution Plan

```
SPRINT A — parallel (6 agents, no inter-dependencies)
  A-1  Academic calendar admin CRUD         ADR-0050
  A-2  Course catalog + section CRUD        ADR-0051
  A-3  Student record editable fields       ADR-0049
  A-4  Faculty assignment creation          ADR-0054
  A-5  Attendance enforcement + alerts      ADR-0053
  A-6  Application document checklist       ADR-0048
  ↓ PR must merge before Sprint B begins

SPRINT B — parallel (4 agents, depend on Sprint A output)
  B-1  Transcript PDF + grade history       ADR-0044
  B-2  Student self-registration add/drop   ADR-0052
  B-3  Stripe payment collection            ADR-0042
  B-4  Financial aid award letter           ADR-0057
  ↓ PR must merge before Sprint C begins

SPRINT C — parallel (3 agents, depend on Sprint B output)
  C-1  Student PWA full self-service        ADR-0055
  C-2  Guardian PWA shell                   ADR-0056
  C-3  Compliance reporting IPEDS           ADR-0058
  ↓ final PR merges — all PARTIAL → WORKING
```

---

## Council Decision

| Role | Vote | Condition |
|------|------|-----------|
| Product Manager | Ship | None |
| Domain Architect | Ship | ADRs written before builders run |
| Data Modeler | Ship | Wave 1 migrations merge before Wave 2 builds |
| Backend Builder | Ship | None |
| Frontend / PWA Builder | Ship | Visual check before each sprint is declared done |
| Security and Privacy Reviewer | Ship | Enforcements in A-3, A-6, B-3, B-4, C-2 |
| Release Validator | Ship | CI gate between every sprint |
| Wildcard | Ship | GPA recalc verified in A-4; IPEDS scoped in C-3; guardian RLS enforced in C-2 |

**Decision: ship this plan. Proceed to ADR-0048 through ADR-0058 and the execution prompts file.**
