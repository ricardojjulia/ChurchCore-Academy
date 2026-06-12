# SIS Competitive Research & ChurchCore Academy Expansion Roadmap

## 1. Research Summary

### The SIS Market Today

The academic Student Information System market divides into three tiers:

**Enterprise (large universities):** Ellucian Banner, Ellucian Colleague, Oracle PeopleSoft Campus Solutions, Anthology Student. These run $500K–$5M+ implementations, require dedicated IT teams, and are inaccessible to small and mid-size faith institutions.

**Mid-market (mid-size colleges):** Jenzabar, Campus Management (Anthology), Workday Student. Similar complexity, $100K–$500K range. Overwhelming for theology schools with 100–2,000 students.

**Small-college and religious-institution market:** Populi, Sonis, ACS Technologies Campus Suite, Orbund, Classter. This is the tier where ChurchCore Academy competes and, by design, dominates.

### Primary Competitor: Populi

Populi is the most direct competitor in the faith-based small-college space. It serves Bible colleges, seminaries, and Christian universities well and has built a loyal base. Starting at **$199/month**, it covers:

- Student Information System (SIS)
- Built-in LMS (with Zoom/BBB integration, tests, assignments, discussions)
- Admissions CRM and online applications
- Financial Aid (including FAFSA/ISIR, COD, Pell)
- Billing and student accounts
- Donor and alumni CRM
- Bookstore
- Housing
- IPEDS reporting

**Populi's documented weaknesses (from 60+ verified reviews):**
- "Plain and lacking" UX; not modern
- "Limited mobile app" with very few features
- No competency-based learning support
- Reporting is rigid; custom reports are frustrating
- No AI-powered advising, early alert, or workflow suggestions
- No faith-specific formation tracking
- No denomination or church partner integrations
- No proactive at-risk student surfacing
- Not designed around theological curriculum structures
- No guardian portal for children's school populations
- Slow iteration on feature requests from the faith community

### ATS (Association of Theological Schools) as the Accreditation Frame

ATS accredits 270+ graduate theological schools in the US and Canada. Compliance with ATS Standards requires:
- Student learning outcome tracking
- Formation and assessment records
- Enrollment, degree, and credit reporting
- Faculty qualification and course assignment records
- Institutional effectiveness evidence

No current SIS is built to make ATS compliance reporting easy for small schools. ChurchCore Academy can own this gap completely.

### AI in SIS: Where Everyone Is and Where ChurchCore Academy Can Lead

Current AI use in academic SIS is limited to:
- PowerSchool's "PowerBuddy" contextual AI assistant (K-12 focused)
- Civitas Learning, EAB Navigate, and Marist Eagle AI (enterprise early-alert platforms)
- Generic GPT-integrated chatbots being bolted onto old systems

None of the small-college SIS platforms (Populi, Sonis, Orbund) have any meaningful AI capability.

**The specific gap:** no platform serving theology schools offers explainable, formation-aware, academic workflow recommendation intelligence.

---

## 2. ChurchCore Academy's Competitive Advantages

### 2.1 Built for Theology Schools from Day One

Generic SIS systems use labels like "program", "course", "credits" and expect administrators to bend them to theology school needs. ChurchCore Academy is built natively for:
- Bible school clock-hour and module completion models
- Seminary credit-based transcript workflows
- Children's school grade-band promotion
- Mixed-mode institutions (college + seminary + Bible school under one roof)
- Ministry practicum, internship, and formation as first-class academic records
- Guardian portal with scoped visibility for minors
- Cohort-based enrollment common in evangelical education
- Faith formation as a distinct, non-graded but tracked record category

### 2.2 Provider-Neutral LMS Integration

No competitor treats LMS as a swappable provider. They either:
- Bundle their own LMS (Populi — good but not best-in-class)
- Depend entirely on Canvas or Moodle with brittle custom integrations

ChurchCore Academy uses a **provider-neutral LMS contract** so any institution can run:
- No LMS (internal-only)
- Moodle (self-hosted control, popular in faith communities)
- Canvas (higher-ed standard)
- Future: Brightspace, Blackboard, Google Classroom

The SIS remains the system of record in all cases. LMS is always an optional delivery mechanism.

### 2.3 ShepherdAI — No SIS Has Anything Like This

ShepherdAI is an **explainable Academic Workflow recommendation engine** — not a chatbot. No small-college SIS offers this. No faith-based SIS offers this at all.

ShepherdAI uses only Academy-owned signals (GPA, credits, enrollment status, completion records, attendance patterns, document holds, transcript readiness) to surface actionable, human-reviewed workflow suggestions.

This is the single most powerful differentiator in the market.

---

## 3. Feature Expansion Roadmap

Organized by competitive priority. All items should move through the software factory before implementation.

### Tier 1 — Close Urgent Competitive Gaps

These are features that Populi has and ChurchCore Academy needs to match before institutions will switch.

#### 3.1 Admissions and Enrollment CRM
- Online application builder (configurable per program and institution type)
- Application fee collection
- Lead pipeline with stages (inquiry → applicant → accepted → enrolled)
- Bulk communication (SMS, email)
- Application status self-service portal for applicants
- Reference collection
- Document checklist per application type
- Conditional requirements (e.g., ordination letter for ministry programs)
- Enrollment agreement with digital signature
- Multiple application types per institution (college + seminary track)
- ATS-compatible pre-enrollment data capture

**ShepherdAI angle:** suggested next-step workflows for admissions staff based on pipeline age and incomplete applications.

#### 3.2 Student Billing and Accounts
- Tuition schedule by program and enrollment type
- Fee rules triggered by registration
- Payment plans and recurring payments
- Online payment collection (Stripe integration)
- Student account statement view
- Aging report for receivables
- Enrollment agreements tied to billing triggers
- Invoice bulk actions
- Accounting software export (QuickBooks, Xero)

#### 3.3 Financial Aid Management
- FAFSA/ISIR import
- Aid packaging and offer letters
- COD sync (for Title IV-eligible institutions)
- Satisfactory Academic Progress (SAP) tracking
- Award disbursement scheduling
- Institutional scholarships and grants
- Seminary-specific scholarship workflows (denominational awards, mission grants)

#### 3.4 Institutional Compliance and Reporting
- ATS student data reporting templates
- IPEDS reporting module (for accredited colleges and seminaries)
- Custom report builder with save/export
- Data export to CSV/Excel for accreditation evidence
- Enrollment headcount by program, term, and mode
- Completion and retention rate dashboards
- Faculty qualification reporting
- FERPA consent management and access log

#### 3.5 Faculty and Staff Portal
- Course management and grade entry
- Attendance tracking (manual and QR-code based)
- Student roster and contact view
- Assignment submission and feedback
- Faculty advising notes
- Faculty qualification records (degree, ordination, credentials)

#### 3.6 Alumni and Donor Relationship Management
- Alumni profile with ministry placement tracking
- Donation collection (one-time, recurring)
- Campaign management
- Donor statements and giving history
- Alumni directory (opt-in, faith-community search)
- Ministry placement board (where are alumni serving)

---

### Tier 2 — Theology-School-Specific Features No Competitor Has

These are ChurchCore Academy's exclusive territory.

#### 3.7 Ministry Formation and Spiritual Development Records
- Non-graded formation record categories separate from academic transcripts
- Categories: chapel attendance, service hours, spiritual direction sessions, ministry practica, mission trips, mentorship records
- Institution-configurable formation requirements per program
- Formation advisor assignment
- Formation progress view for student and advisor
- Formation record release policy (what can appear on public record vs. internal only)
- Formation-aware graduation readiness check

**ShepherdAI angle:** surface students approaching formation requirements before transcript requests, detect students behind on formation milestones alongside academic standing.

#### 3.8 Competency-Based and Narrative Evaluation
- Competency framework builder (custom competency sets per institution/program)
- Competency-level grading (emerging / developing / proficient / advanced)
- Narrative evaluation entry alongside or instead of letter grade
- Competency-to-course mapping
- Competency transcript format (separate from credit transcript)
- Children's school progress record with guardian-releasable narrative entries
- Pass/fail completion records without GPA (Bible school model)
- Mixed evaluation types per institution

This is a documented weakness of Populi that multiple reviewers flagged. ChurchCore Academy already has the data model for this.

#### 3.9 Cohort and Modular Enrollment Management
- Cohort creation and assignment (all students in a cohort enrolled together)
- Modular scheduling (courses run in 4–8 week blocks, not full semesters)
- Clock-hour accumulation tracking
- Intensive and retreat-style course formats
- Hybrid delivery tracking (in-person block + online self-paced component)
- Cohort-based graduation requirements
- Multi-site cohort management (students from different campuses in same cohort)

#### 3.10 Denomination and Church Partner Integration
- Denomination directory integration (students coming from a sponsoring church)
- Church-funded scholarship tracking linked to sponsoring church record
- Church endorsement letter and credential tracking
- Ministry placement coordination (church receiving a graduate)
- Alumni ministry relationship back to sending church
- Permission model: church partner can view their sponsored students' basic progress (scoped, not full records)

#### 3.11 International Student and Multilingual Support
- English-as-second-language enrollment indicators
- Visa and immigration document checklist
- Multiple language support for student-facing portals (Spanish, Portuguese, French, Mandarin, Korean — the top languages in global theological education)
- Date/timezone localization per campus
- Currency support for international tuition collection
- Cross-border transcript verification support

#### 3.12 Certificate, Continuing Education, and Non-Degree Programs
- Certificate programs with defined completion requirements
- Continuing Education Unit (CEU) tracking
- Auditor enrollment (no credit, no grade)
- Community enrollment (non-student attending single courses)
- Ministry training program records (non-accredited tracks)
- Digital badge issuance on completion
- Certificate registry (institution-managed credential verification)

---

### Tier 3 — ShepherdAI Expansion Features (No SIS Offers These)

ShepherdAI is ChurchCore Academy's differentiation category. These features should be designed carefully and move through the factory with full explainability review before implementation.

#### 3.13 Academic Early Alert
- At-risk signal detection: GPA trend below threshold, missing required courses, incomplete enrollment, overdue holds, formation gap approaching term deadline
- Suggested workflow: "Review enrollment with student", "Schedule advising appointment", "Send academic warning communication"
- Human review gate: no signal auto-triggers communication without staff action
- Explainability panel: which signals drove this suggestion, what threshold was crossed
- Outcome tracking: was the suggested workflow completed? Did student situation improve?

#### 3.14 Graduation Readiness Workflow Automation
- Real-time graduation audit as credits accumulate
- Gap identification: "Student needs 3 more credits in Old Testament exegesis to meet program requirements"
- Suggested next course sequence (based on prerequisites and availability)
- Transcript posting readiness check
- Formation requirement gap check
- Outstanding holds check before degree conferral
- Draft degree conferral workflow for registrar

#### 3.15 Enrollment Pattern Intelligence
- Cohort health score: completion rate prediction per active cohort
- Course section fill rate analysis: which courses under-enroll, which over-enroll
- Schedule conflict detection across sections
- Suggested section adjustments based on historical enrollment patterns
- Ministry practicum placement match suggestions (based on student interest and available sites)

#### 3.16 Advising Workflow Intelligence
- Advisor case queue with priority ranking by signal severity
- Draft advising communication templates generated from student record context
- Meeting note suggestions based on outstanding flags
- Caseload balance monitoring across advisor assignments
- Student communication cadence tracking (how long since last contact?)

#### 3.17 Academic Standing Automation
- Automated academic standing calculation (good standing / warning / probation / dismissal)
- Configurable thresholds per institution type and program
- Standing change notification workflow (human-reviewed before sending)
- Academic standing history record
- Standing-linked registration holds
- Financial aid SAP linkage

#### 3.18 Faculty Load and Course Assignment Intelligence
- Faculty qualification check against course assignment (does this professor's credentials match course level?)
- Teaching load balance across faculty
- Suggested course assignment based on faculty expertise and availability
- ATS-required faculty ratio monitoring
- Visiting lecturer and adjunct tracking with credential expiry alerts

#### 3.19 Student Formation AI Companion (Long-Term Vision)
- ShepherdAI reading of formation records to suggest pastoral follow-up workflows for formation advisors
- Suggested formation enrichment based on program goals and student record
- Formation milestone proximity notification for students and advisors
- Formation goal setting (student-driven, advisor-reviewed)
- This must remain non-chatbot: suggestion-only, human-reviewed, privacy-safe

---

## 4. Market Positioning

### Target Segments

| Segment | Size Range | Current Solution | Switching Trigger |
|---|---|---|---|
| Bible institutes and schools | 20–300 students | Excel / paper / Orbund | Formation tracking, modern UX, cost |
| ATS-accredited seminaries | 50–500 students | Populi / Sonis | ATS compliance tooling, ShepherdAI |
| Evangelical colleges | 200–2,000 students | Populi / Jenzabar | Canvas/Moodle flexibility, AI, modern UX |
| Children's school/education ministries | 10–200 students | Paper / simple apps | Guardian portal, grade-band model |
| Mixed-mode faith universities | 500–5,000 students | Ellucian / Anthology | Too expensive + no faith specificity |
| International missions training | 10–500 students | None / custom | Multilingual, cohort model, CLs/CEUs |
| Online Bible degree programs | Any | Populi or custom | Full LMS integration, student PWA |

### Pricing Philosophy

- Per-student monthly pricing (no large upfront contracts)
- Flat base fee plus per-active-student increment
- ShepherdAI included in base — not an expensive add-on module
- LMS integration included — not an extra connector fee
- No surprises, no hidden implementation fees
- Self-serve setup path for smaller institutions

### Messaging

**Primary:** "The only SIS built from the ground up for theology schools — not a generic system with a faith label added later."

**ShepherdAI:** "The first academic SIS to offer explainable AI-driven workflow suggestions designed specifically for faith-based education, not a generic chatbot."

**LMS:** "Run your preferred LMS — Moodle, Canvas, or neither — without losing control of your student records."

**Size:** "Works the same whether you have 30 students or 3,000. Bible institute, seminary, college, or university."

---

## 5. Feature Priority Matrix

| Feature | Competitive Gap | Faith-Specific | ShepherdAI Enabled | Priority |
|---|---|---|---|---|
| Admissions CRM | Matches Populi | Conditional faith-record requirements | Pipeline aging suggestions | Tier 1 — urgent |
| Student Billing | Matches Populi | Denominational scholarship rules | None | Tier 1 — urgent |
| Financial Aid | Matches Populi | Seminary/mission grant types | SAP alerts | Tier 1 — urgent |
| Compliance reporting (ATS/IPEDS) | Populi partial, no ATS-native | ATS-native format | None | Tier 1 — urgent |
| Faculty portal | Matches Populi | Credential/ordination tracking | Load intelligence | Tier 1 — urgent |
| Alumni/Donor CRM | Matches Populi | Ministry placement tracking | None | Tier 1 — urgent |
| Formation records | No competitor has this | Core theology need | Formation gap alerts | Tier 2 — differentiator |
| Competency/narrative grading | Populi explicitly weak here | Bible school / children's school | None | Tier 2 — differentiator |
| Cohort/modular enrollment | Populi partial | Clock-hour Bible school | Cohort health | Tier 2 — differentiator |
| Denomination/church integration | No competitor has this | Core faith community need | Sponsorship alerts | Tier 2 — differentiator |
| Multilingual / international | Populi very weak | Global missions scope | None | Tier 2 — differentiator |
| Certificate and CEU programs | Populi partial | Ministry continuing ed | None | Tier 2 — differentiator |
| Academic early alert | No small-college SIS has this | Formation + academic combined | Core ShepherdAI | Tier 3 — AI-lead |
| Graduation readiness automation | No small-college SIS has this | Formation gap + academic | ShepherdAI | Tier 3 — AI-lead |
| Advising workflow intelligence | No SIS has this at this level | Faith formation advising | ShepherdAI | Tier 3 — AI-lead |
| Academic standing automation | Partial in Populi, no AI | Faith-appropriate standing language | ShepherdAI | Tier 3 — AI-lead |
| Faculty load intelligence | Enterprise-only today | ATS ratio compliance | ShepherdAI | Tier 3 — AI-lead |

---

## 6. What Populi Reviewers Actually Want (and ChurchCore Academy Can Deliver)

From verified review data and community feedback patterns:

1. **Better mobile app** — reviewers consistently note Populi's mobile experience is limited. ChurchCore Academy's Student PWA is a first-class surface built as a progressive web app from day one.

2. **Competency-based learning** — multiple reviewers flagged this as a gap. Already in ChurchCore Academy's data model.

3. **Custom reporting** — reviewers want to filter and export exactly the data they need. ChurchCore Academy should build a flexible report builder with institution-specific field access.

4. **Modern UX** — reviewers consistently describe Populi as functional but plain. ChurchCore Academy's Mantine-based UI is a modern, accessible design system.

5. **Better integration with external LMSs** — Populi's built-in LMS is serviceable but not best-in-class. ChurchCore Academy's provider-neutral LMS contract solves this at the architecture level.

6. **AI-powered help** — no reviewer mentioned AI because no small-college SIS offers it. This is an undiscovered desire that ShepherdAI can create as a market expectation ChurchCore Academy alone satisfies.

---

## 7. Next Factory Work Packages

Based on this research, the following work packages should enter the factory queue after the current Canvas adapter sprint:

1. **Admissions CRM foundation** — intake/design/spec/plan for the inquiry-to-enrolled lifecycle
2. **Student billing foundation** — tuition schedules, payment collection, account statements
3. **Formation records model** — design spec for non-graded formation tracking, separate from academic transcript
4. **ATS compliance reporting** — reporting templates mapped to ATS Standards data requirements
5. **Competency evaluation model** — extend grading system with competency frameworks and narrative entries
6. **ShepherdAI academic early alert** — signal definitions, scoring, explainability rules, workflow suggestions
7. **Faculty portal and qualification records** — credential tracking, teaching assignment, load monitoring
8. **Alumni and ministry placement** — post-graduation tracking, church placement, ministry records
9. **Certificate and CEU programs** — non-degree completion records, digital credential issuance
10. **Denomination and church partner access model** — scoped read access for sponsoring churches

Each work package follows the factory path: intake → discovery → options → design spec → implementation plan → execution → verification → review → delivery.
