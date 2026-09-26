# ChurchCore Academy — MVP and Competitive Status

**Date:** 2026-09-25 · **Scope:** `main` at the merge of PR #155 · **Method:** every status below was checked against code on `main` and, where marked, against the automated e2e suite that now runs on every PR. Planning documents were used for definitions only, not as evidence (they have drifted from reality several times — see §7).

---

## 1. Bottom line

| Question | Answer |
|---|---|
| **Is the MVP built?** | **Yes, functionally.** All 11 steps of the Core Academic Loop work end to end in a production build against a database built from migrations. Steps 1–8 and 10 are exercised automatically on every PR; steps 9 and 11 were verified by hand on 2026-09-17 and are not yet in an automated journey. |
| **Is it live?** | **No.** Academy is not deployed anywhere: the Vercel team has one project (`church-core-ops`), and Academy has no hosted Supabase project. Every "production" issue below was found in production *builds*, not a live deployment — no real user was ever exposed. |
| **Is it trustworthy?** | **Much more than a week ago.** A required CI gate now runs 394 end-to-end checks (every page and API method, as every role, plus workflow journeys) against a production build. Its first runs found and closed 3 security holes and ~25 functional bugs that 2,000 mock-database unit tests had missed. Zero known issues are pinned open in the suite. |
| **How does it compare to Populi?** | **At parity or ahead on the academic core, admissions, portals, and faith-specific features; behind on U.S. federal aid (FAFSA/ISIR, COD), bulk/SMS campaigns, donor campaigns, a custom report builder, and multilingual UI.** Differentiators no small-college competitor has — formation records, denomination/ordination, ShepherdAI signals, guardian portal, competency grading — are built. |
| **What blocks a first customer?** | Deployment (hosting, data, credentials), trusted institution resolution for the public portal (#162), and a product decision on which parity gaps a first customer actually needs. |

---

## 2. The MVP

### 2.1 Definition

From `docs/product/product-context.md`: *"If an admin cannot complete steps 1–11 end-to-end in the browser, the system does not work."* Done means an admin completes the workflow in a browser without a dead end, the data persists, errors surface, tenants are isolated, and the feature is reachable from navigation.

### 2.2 Core Academic Loop — status by step

| # | Step | Built | Verified how |
|---|---|---|---|
| 1 | Create Academic Year | ✅ | Automated: `e2e/journeys/core-academic-loop.spec.ts` (every PR) |
| 2 | Add Academic Periods | ✅ | Automated (same journey) |
| 3 | Create Courses in the catalog | ✅ | Automated, incl. activation |
| 4 | Create a Program | ✅ | Automated |
| 5 | Create a Section in a Period | ✅ | Automated, incl. opening the section |
| 6 | Assign an Instructor | ✅ | Automated (section created with instructor; instructor sees it) |
| 7 | Enroll a Student in a Program | ✅ | Automated (program membership for a catalog year) |
| 8 | Enroll a Student in Sections | ✅ | Automated |
| 9 | Track progress against requirements | ✅ | Manual walkthrough 2026-09-16/17; page sweep confirms it renders for every role. **Not yet in a journey.** |
| 10 | Record a Grade | ✅ | Automated (instructor creates assignment, grades, sees it in the gradebook UI; student and other tenant refused) |
| 11 | Produce a Transcript Entry | ✅ | Manual walkthrough 2026-09-17 (grade → final grade → registrar posts → immutable entry). **Not yet in a journey.** |
| — | Context picker (year/period) | ✅ | Working since 2026-07; page sweep covers it |
| — | Student Groups (cohorts) | ✅ | Page sweep; browser-verified 2026-07-09 |

**Gap to close:** extend the core-loop journey through steps 9 and 11 so the whole MVP definition is enforced by CI, not by a one-time walkthrough.

### 2.3 Surfaces around the loop (all behind the same CI gate)

| Area | Status |
|---|---|
| Admin app (registrar, deans, academic admins, finance, admissions) | Working; role-gated navigation and pages |
| Faculty portal | Working. This week: fixed three pages that crashed for everyone, and added portal-level role gating (students/guardians could previously open rosters) |
| Student PWA | Working; students only, other roles redirected home |
| Guardian portal | Working. This week: child detail page fixed (was crashing), own navigation shell (was showing staff sidebar) |
| Public applicant portal | Working. This week: made reachable (was blocked by the proxy since June) and made submission work (two schema bugs) |
| Graduation audit + clearance workflow | Working as of today (PR #155) |
| Compliance reports (IPEDS/ATS/Title IV snapshots) | Working as of 2026-09-25 (had never worked — uuid tenant ids) |
| ShepherdAI (signals, workflows, watchlist, retention risk) | Working as of 2026-09-25 (watchlist and risk scoring were both built on columns that don't exist) |
| OneRoster export + signed LMS delivery | Working (delta export); deletion reconciliation open (#164) |

### 2.4 Quality gates

| Gate | What it checks | Where |
|---|---|---|
| `npm test` | 2,021 unit tests (286 files) + the **surface coverage gate**: every page and API method must be registered with its access list | CI "Test, lint, and build" (required) |
| `npm run test:full` | 394 checks on a **production build** + **fresh database from all 116 migrations**: every one of 103 pages and ~290 API methods as 16 personas + signed-out, plus 6 workflow journeys (admissions portal, core loop, graduation clearance, ShepherdAI, student portal, guardian portal) and 4 focused regression specs | CI "E2E (browser + API)" (required since 2026-09-25) |
| Process | New pages/APIs need manifest entries; new workflows need a journey; factory agents and PR template enforce it | ADR 0073, `docs/testing/e2e-suite.md` |

Known issues pinned in the suite: **0**.

---

## 3. What changed in the last week (why the MVP is now credible)

Before the suite existed, "working" meant unit tests with mock databases plus occasional manual walkthroughs. The first production-build runs found:

**Security (all fixed)**
- Any signed-in user, including students, could create and delete academic years, periods, courses, and sections (#178).
- Any signed-in user could list every student's record, names and emails included (#178).
- Students and guardians could open the faculty portal (rosters, gradebooks) (#189).

**Availability (all fixed)**
- The public applicant portal, all Vercel cron jobs (including the every-minute email worker), and the Stripe webhook were blocked by the proxy since June (#168).
- Every public application submission failed on two schema mismatches once reachable (#168).
- In production builds, sign-in bounced back to the login page, and every access denial showed a crash screen (#167).

**Correctness (all fixed)** — pages that crashed for their own users (faculty schedule/sections/signals, guardian child page, applicant/guardian detail, academic-admin faculty review, ShepherdAI watchlist), compliance reports that could never save, retention-risk scoring on nonexistent tables, graduation clearance whose migration could not apply and whose tests never ran, legacy redirects dropping ids, 500s for client errors (#169–#181, #187, #188, #155).

The common root cause: code written against an imagined schema and "verified" by mock-database tests. The CI gate is designed to make that failure mode impossible to merge.

---

## 4. Deployment readiness

**Not deployed.** `vercel.json` defines cron jobs and CLAUDE.md says "deployed on Vercel", but no Vercel project or hosted database exists for Academy (checked 2026-09-25: the ChurchCore Vercel team has only `church-core-ops`; the Supabase organization has *ChurchCore Ops*, *ChurchCore Ops Control Plane*, and *faithfull-scholars-prod*).

To reach a first real deployment:

| Need | Status |
|---|---|
| Hosted Supabase project, all migrations applied | Not created |
| Vercel project (production = `main`, previews = PRs), env vars (`DATABASE_URL`, Supabase keys, `CRON_SECRET`, `ACADEMY_DEFAULT_TENANT_ID`) | Not created |
| Real accounts (demo logins share one known password) | Not done |
| Trusted institution resolution for the public portal (today `?tenant=` / env default) | Open — #162 |
| Stripe, Resend, AI keys | Optional; features return 503 "not configured" without them |
| Tenant provisioning | Works (platform provisioning path is exercised by the e2e seed) |

Recommendation: stand up a **staging** deployment with demo data first (a preview of what a customer would see), then production with an empty tenant provisioned through the platform control panel.

---

## 5. Competitive status

### 5.1 Market position

Academy competes in the small-college / faith-institution tier (Populi, Sonis, ACS Campus Suite, Orbund, Classter), not enterprise (Banner, PeopleSoft, Workday). **Populi is the primary competitor**: $199/month and up; SIS + built-in LMS + admissions CRM + financial aid (FAFSA/ISIR, COD, Pell) + billing + donor/alumni CRM + bookstore + housing + IPEDS. Its documented weaknesses: plain UX, weak mobile, no competency learning, rigid reporting, no AI/early alert, no formation or denominational features, no guardian portal.

### 5.2 Populi parity — the 15-item gap list (2026-09-13) revisited

| # | Populi feature | Status today | Evidence |
|---|---|---|---|
| 1 | Public applicant self-service portal | ✅ **Closed** — apply, status by token, document upload, fee, agreement | Admissions journey (CI); #143, #156, #157, #168 |
| 2 | Lead pipeline (inquiry → applicant) | ✅ **Closed** | #135 |
| 3 | Bulk SMS/email campaigns | 🟡 **Partial** — email drip sequences; no SMS, no ad-hoc bulk campaigns | `/admin/admissions/drip-sequences`; no SMS channel in communications |
| 4 | Application fee collection | ✅ **Closed** | #156 |
| 5 | E-signature on enrollment agreements | ✅ **Closed** (click-to-sign with hash/audit) | #157 |
| 6 | Conditional application requirements | 🟡 **Mostly** — per-program document requirements, waiver, decision gate; not conditional on application answers | #142, #143, #154 |
| 7 | FAFSA/ISIR import | ❌ Open | No ingestion code |
| 8 | COD push-sync | ❌ Open — disbursements recorded, not transmitted | `federal-aid.ts` is recording-only |
| 9 | Donor campaign management | ❌ Open — gifts + fund-designation filter only | `people/alumni` |
| 10 | Alumni directory (opt-in) | ❌ Open | — |
| 11 | Bookstore | ⛔ Non-goal (product boundary) | — |
| 12 | Housing | ⛔ Non-goal (product boundary) | — |
| 13 | Built-in LMS | ⛔ Deliberate — provider-neutral contract + first-party ChurchCore LMS | `lms-contract`, OneRoster |
| 14 | Custom report builder | ❌ Open — fixed CSV/IPEDS exports only | `reporting` |
| 15 | Multilingual UI | ❌ Open | No i18n layer |

**Score: 5 closed, 2 partial, 6 open, 3 deliberate non-goals** (was 0 closed on 2026-09-13).

### 5.3 Research priority matrix — status

**Tier 1 — close urgent gaps**

| Area | vs Populi | Notes |
|---|---|---|
| Admissions CRM | **At parity** (minus SMS/bulk) | Full applicant lifecycle through conversion to student |
| Student billing | **At parity (core)** | Ledger, manual payments, tuition schedules, payment plans, Stripe boundary; live settlement needs keys |
| Financial aid | **Behind** | Aid packages/awards/letters, SAP evaluations, disbursement records; no FAFSA/ISIR, no COD |
| Compliance reporting | **Partial** | IPEDS export (self-disclaimed "review required"); compliance report records (IPEDS/ATS/Title IV snapshots) now work; not certified, no ATS-native format |
| Faculty portal | **At parity** | Schedule, sections, rosters, attendance, gradebook, final grades, signals |
| Alumni/donor CRM | **Behind** | Records + giving; no campaigns, no directory |

**Tier 2 — theology-school differentiators (no competitor has these)**

| Area | Status |
|---|---|
| Formation records (practicum, milestones, evaluations, endorsement, advisors) | ✅ Built (browser-verified 2026-09-15) |
| Competency/narrative grading | 🟡 Configuration built (#117); student-level competency transcript not built |
| Cohort / modular enrollment | 🟡 Student groups + rolling-enrollment calendars; cohort-level requirements not built |
| Denomination / ordination tracking | ✅ Built (#114) |
| Church-partner scoped access | ❌ Not built |
| Multilingual / international | ❌ Not built |
| Certificate / CEU programs | 🟡 Course level `continuing_education` and certificate credentials exist; no CEU-specific workflow |

**Tier 3 — ShepherdAI (no small-college SIS offers these)**

| Area | Status |
|---|---|
| Academic early alert (deterministic signals, explained) | ✅ Built; watchlist fixed 2026-09-25 |
| Graduation readiness | ✅ Audit page + clearance workflow (today) |
| Academic standing automation | ✅ Built (#121), human-reviewed holds |
| Retention-risk scoring | ✅ Works as of 2026-09-25 (#192) |
| Advising workflow intelligence / caseloads | ❌ Not built |
| Faculty load intelligence | ❌ Not built |
| LLM wording assistance | 📐 Designed only (ADR 0070, not built) |

### 5.4 Where Academy wins today

1. **Faith-specific depth** — formation, denomination/ordination, competency/narrative grading configuration: none of these exist in Populi.
2. **ShepherdAI** — explainable, deterministic signals, standing automation, graduation readiness, retention risk. No small-college SIS has an equivalent.
3. **Portals** — student PWA and guardian portal (Populi's mobile is weak; it has no guardian portal).
4. **Architecture** — provider-neutral LMS contract with a first-party LMS, OneRoster export with signed delivery.
5. **Engineering quality bar** — every surface tested as every role on every PR (enterprise-grade assurance at small-college scale).

### 5.5 Where Academy loses today

1. **U.S. federal aid** (FAFSA/ISIR import, COD transmission) — table stakes for Title IV institutions; disqualifying for them until built.
2. **Not deployed** — no live instance to demo or pilot.
3. **Custom reporting** — the #1 Populi reviewer complaint is also unaddressed here.
4. **Donor/alumni** — campaigns and directory.
5. **SMS and bulk communications.**
6. **Multilingual** — relevant to global missions and ESL populations.

---

## 6. Recommended next steps (in order)

1. **Deploy staging** (hosted Supabase + Vercel, demo data) so there is something to show. *Needs owner approval — creates billable resources.*
2. **Close #162** (trusted institution resolution) before any public portal goes live.
3. **Extend the core-loop journey through steps 9 and 11** so the MVP definition is fully enforced by CI.
4. **Decide the first target customer profile.** Title IV-participating schools require FAFSA/ISIR + COD; Bible schools, seminaries without Title IV, and children's schools do not — those are winnable now.
5. Then, by customer need: custom report builder → SMS/bulk campaigns → donor campaigns + alumni directory → advising/faculty-load intelligence → multilingual → OneRoster deletion reconciliation (#164).

---

## 7. Caveats and method

- **Status docs drift.** The 2026-09-12 audit found the product-context table stale; the 2026-09-13 closure plan listed items as missing that had shipped. This report re-verified against code and CI instead of trusting either.
- **"Built" means working in a production build against a real schema**, verified by the CI e2e suite or (for steps 9 and 11) a documented manual walkthrough. It does not mean deployed or used by a real institution.
- **Not certified**: IPEDS export is review-required, not a certified filing; ATS reporting is a snapshot record, not an ATS-native format.
- **Open GitHub issues:** #162 (portal institution resolution), #164 (OneRoster deletion reconciliation), #165 (Copilot review not running — account setting).

Sources: `docs/product/product-context.md`, `docs/product/sis-competitive-research-and-expansion-roadmap.md`, `docs/superpowers/plans/2026-09-13-competitive-feature-closure-plan.md`, `docs/testing/e2e-suite.md`, ADR 0073/0074, merged PRs #135–#192, and the CI runs on `main`.
