# ADR-0045 — Ministry Formation Records Model and Privacy Boundary

**Date:** 2026-06-22
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)

---

## Context

No competitor SIS has a first-class model for faith formation tracking. Bible schools, seminaries, and ministry programs require records that academic grade systems were never designed to hold: baptism dates, ordination milestones, ministry practicum hours, spiritual formation evaluations, pastoral endorsements, and faith journey markers.

These records are pastoral in character, not academic. They carry a different trust model than a transcript:

- A student's GPA is shared with advisors, registrars, guardians, and potential employers.
- A student's spiritual formation evaluation is a pastoral document shared only with specific ministry leaders.
- Guardians who can view a child's report card should not automatically see a student's pastoral notes from a formation counselor.

No existing Academy domain (grading, official records, people) fits this shape. Mapping formation records onto academic evaluation types would corrupt the privacy model of both domains. Ministry formation also requires its own document output — a "formation transcript" — that is distinct from the academic transcript governed by ADR-0011.

The competitive roadmap (docs/competitive-roadmap.md) identifies Ministry Formation Records as a Tier 3 differentiator with target status ADR-0045 before implementation begins.

---

## Decision

### 1. New module

Add a `ministry-formation` domain module at `src/modules/ministry-formation/`. This module owns all formation record types, repository functions, and privacy rules. No formation data is stored under grading, people, or official-records domains.

### 2. Core entities

**`MinistryFormationRecord`** — a faith milestone event attached to a student:

- `id`, `tenant_id`, `student_id`
- `milestone_type`: enum — `baptism`, `ordination`, `commissioning`, `confirmation`, `rededication`, `custom`
- `milestone_date`
- `notes` — pastoral notes; treated as sensitive field
- `witness_id` — references a staff/faculty member who witnessed or endorsed
- `endorsed_at` — timestamp; once set, record is immutable (see §5 below)
- `endorsed_by_id`

**`MinistryPracticumLog`** — hourly log of supervised ministry work:

- `id`, `tenant_id`, `student_id`, `section_id` (optional course link)
- `hours`, `site_name`, `supervisor_name`, `supervisor_contact`
- `log_date`, `reflection` — student-authored reflection text
- `approved_by_id`, `approved_at`

**`MinistryFormationEvaluation`** — rubric-based pastoral evaluation by faculty:

- `id`, `tenant_id`, `student_id`, `evaluator_id`
- `rubric_id` — references a tenant-defined rubric
- `score`, `pastoral_notes` — sensitive field
- `evaluation_date`
- `released_at` — controls student visibility

### 3. Database tables

Three append-only tenant-scoped tables:

- `academy_ministry_formation_records`
- `academy_ministry_practicum_logs`
- `academy_ministry_formation_evaluations`

All tables carry `tenant_id` as the first column. Row-level security policies enforce tenant isolation. Endorsed and approved rows are protected by column-level update restrictions — the application layer checks `endorsed_at IS NOT NULL` before allowing any mutation.

### 4. Privacy and access control

Formation records are **not** exposed on the standard student profile. Access requires the explicit role permission `ministry_formation_reviewer` in addition to normal Academy role checks.

Access matrix:

| Actor | Formation records | Practicum logs | Evaluations | Pastoral notes |
|-------|:-----------------:|:--------------:|:-----------:|:--------------:|
| Student (own) | own milestones only | own logs only | released only | never |
| Guardian | no access | no access | no access | no access |
| Faculty (section) | students in section | students in section | own evaluations | own only |
| Advisor (advisee) | advisees only | advisees only | released only | never |
| Ministry Formation Reviewer | full tenant scope | full tenant scope | full tenant scope | yes |
| Registrar | formation transcript view | practicum totals | released only | never |

Guardians have no access to any formation record, evaluation, or pastoral note. This is a deliberate pastoral privacy boundary and must not be relaxed by feature flags or operating rules at runtime.

### 5. Immutability on endorsement

Endorsed formation records and approved practicum logs follow the same append-only audit pattern as ADR-0019. Once `endorsed_at` or `approved_at` is set:

- Application code must reject any update to content fields.
- Corrections are made by superseding with a new record linked to the original via `supersedes_id`.
- Every endorsement and superseding action produces an immutable `AcademicRecordAuditEvent` scoped to the `ministry_formation` domain.

### 6. ShepherdAI boundary

ShepherdAI signal functions may read:

- Aggregate practicum hour totals (for completion signals)
- Boolean milestone flags (e.g., `has_completed_practicum`)

ShepherdAI signal functions must never read:

- `pastoral_notes`
- `reflection` text from practicum logs
- `MinistryFormationEvaluation` rubric scores or notes

These restrictions are enforced in the ShepherdAI signal query layer, not merely by convention.

### 7. Formation transcript

Formation records are **not** included in the academic transcript governed by ADR-0011. A separate `FormationTranscript` document type is defined in the ministry-formation module, produced by the registrar or a designated ministry formation reviewer. Formation transcripts are governed by the same hold/release pattern as academic transcripts but are a distinct document with a distinct access control check.

---

## Consequences

- Bible schools, seminaries, and ministry programs gain a first-class system of record for formation data with no competitor equivalent.
- The pastoral privacy boundary is explicit and enforceable at the role/permission layer, not just by policy.
- Formation data cannot accidentally leak into academic transcripts, student profile reads, or guardian portals.
- Implementation must add `ministry_formation_reviewer` to the permission catalog and to the role assignment UI.
- The formation transcript document type must be wired into the print/export strategy (ADR-0029) as a separate output path.
- ShepherdAI signal tests must verify that pastoral note fields are absent from any signal read path (use `doesNotMatch` per testing conventions).

---

## Alternatives Considered

**Extend grading module with a "formation grade" type:**

- Rejected. Grading is academic by design. Formation evaluations have a pastoral rubric, endorser relationship, and privacy model that does not fit evaluation-to-grade-to-transcript flow. Mapping them would corrupt both domains.

**Store formation records under the people module as student profile attributes:**

- Rejected. Profile attributes are broadly readable within a tenant. Formation records require a narrow permission check that the people module does not enforce.

**Use a single `custom_record` catch-all table:**

- Rejected. It would produce a schema-less blob that cannot be validated, indexed, or queried for practicum hour totals or ShepherdAI signals without unsafe JSON extraction.

**Dedicated ministry-formation module with explicit privacy model:**

- Accepted. Clear domain boundary, explicit permission gate, immutable endorsement, ShepherdAI read restriction, and separation from academic transcript.

---

## Review Notes

- Product boundary: the ministry-formation module owns all formation entities and privacy rules. The grading and official-records modules must not be extended to hold formation data.
- Security/privacy: `pastoral_notes` and evaluation rubric scores must never appear in API responses to roles without `ministry_formation_reviewer`. Guardian access must be denied unconditionally, not gated by a configurable flag.
- Testing: every module function requires a success case, a cross-tenant rejection case, a guardian-access denial case, and a `doesNotMatch` assertion confirming pastoral note fields are absent from non-reviewer responses.
- Rollback: tables are additive; migration can be reverted independently of academic schema tables. The `ministry_formation_reviewer` permission must be removed from all role assignments before the migration is rolled back.

---

## Related

- ADR-0002 — Institution type model (Bible school, seminary modes that need this domain)
- ADR-0011 — Official record transcript and audit model (formation transcript is a separate document type)
- ADR-0019 — Immutable audit events and outbox boundary (endorsement audit pattern)
- ADR-0029 — Official records print and export strategy (formation transcript output path)
