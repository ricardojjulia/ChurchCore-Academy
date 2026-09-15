# ADR 0063: Covenant Record Spiritual Profile Model

Date: 2026-06-30
Status: proposed

---

## Context

Faith-based institutions track a category of person-level information that no secular SIS provides: the spiritual journey and covenant commitments of students, faculty, and staff. Currently ChurchCore Academy stores Ministry Formation Records (ordination status, denomination membership) which cover formal credentials. There is no structured place for personal spiritual journey data such as faith decisions, baptism, church membership, or institutional covenant commitments.

This data is currently managed through free-text advisor notes, custom spreadsheets, or paper files — creating a gap that every competing faith-based system (Populi, Ministry Platform, custom church management systems) has not addressed structurally.

The Council Review IV Wildcard Strategist proposed the Covenant Record as a product-differentiating feature for faith-based institutions.

---

## Decision

### 1. What the Covenant Record Is

A `CovenantRecord` is an optional, institution-configurable spiritual profile layer attached to any `Person` record. It stores structured data about a person's spiritual journey and formal covenant commitments to the institution.

It is **not** an academic record. It does not affect GPA, transcripts, enrollment status, or graduation requirements. It is a pastoral and administrative instrument.

### 2. What the Covenant Record Contains

The record has two parts:

**Fixed fields (always present when the record exists):**
- `personId` — the person this record belongs to
- `tenantId` — required for isolation
- `createdAt`, `updatedAt`

**Configurable fields (stored as JSONB `covenant_fields`):**

Institutions configure which fields are active. The type system defines the available field keys; institution configuration determines which keys appear in the UI.

Available field keys:
- `faithDecisionDate` — date of salvation/faith commitment
- `baptismDate` — date of baptism
- `baptismForm` — form of baptism: `immersion` | `sprinkling` | `affusion` | `other`
- `homeChurchName` — name of home church
- `homeChurchCity` — city of home church
- `covenantStatus` — institution-defined covenant status: `not_signed` | `signed` | `renewed` | `inactive`
- `covenantSignedDate` — date covenant was signed or last renewed
- `covenantWitnessName` — name of witness or signing authority
- `spiritualFormationTrack` — institution-defined label (free text, institution configures options)
- `notes` — short freeform note (max 1000 chars), pastoral only, never visible to student

**Institution configuration:**

The `InstitutionProfile.capabilities` gains a boolean `covenantRecords`. If false, the Covenant Record tab never appears and the table is never queried.

Institutions configure active field keys through a future capability setting; in MVP, all available field keys are shown when `covenantRecords = true`.

### 3. Schema

New table: `academy_covenant_records`

```sql
create table if not exists academy_covenant_records (
  id text primary key,
  tenant_id text not null references academy_institution_profiles(tenant_id) on delete cascade,
  person_id text not null references academy_people(id) on delete cascade,
  covenant_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academy_covenant_records_tenant_person_idx
  on academy_covenant_records (tenant_id, person_id);
```

One record per person per tenant (enforced by unique index). Created on first save; queried via `left join` so persons without a record return null.

### 4. Access Model

| Action | Allowed Roles |
|--------|---------------|
| Read own Covenant Record | The person themselves (student, staff) |
| Read any Covenant Record | institution_admin, dean, academic_admin, advisor (for assigned students) |
| Write Covenant Record | institution_admin, dean, academic_admin, advisor (for assigned students) |
| Read `notes` field | institution_admin, dean, academic_admin only (never the person themselves) |
| Write `notes` field | institution_admin, dean, academic_admin only |

Guardians may never read or write a Covenant Record.

### 5. Module Location

Covenant Record logic lives in `src/modules/people/covenant-mutations.ts`. Types are added to `src/modules/people/types.ts`.

### 6. Audit Requirements

All writes to a Covenant Record emit to `academy_audit_events` with action `update_covenant_record`. The `redacted_metadata` includes the `field_changed` key(s). Old values of `faithDecisionDate`, `baptismDate`, and `covenantSignedDate` are stored as SHA-256 hashes. Other field old values are stored in plain text (they are not sensitive in the same way PII is).

`notes` field changes emit a separate audit event with action `update_covenant_notes`; the old notes value is hashed.

### 7. ShepherdAI Integration

When `covenantRecords` is enabled, ShepherdAI may include Covenant Record completeness as a signal input for pastoral outreach workflow recommendations. ShepherdAI does not read the `notes` field. ShepherdAI only reads structured boolean signals (e.g., "has faith decision date", "covenant signed", "formation track assigned") — never the date values themselves.

This maintains ShepherdAI's identity as a deterministic signal engine, not an AI reading private pastoral notes.

---

## Consequences

**Easier:**
- Faith-based institutions can track spiritual journey data in structured, queryable form for the first time in a SIS
- Covenant Record completeness can drive ShepherdAI pastoral workflow signals
- The JSONB `covenant_fields` approach allows new field keys to be added without schema migrations
- The opt-in capability flag (`covenantRecords`) means zero impact on institutions that don't use it

**Harder:**
- Institution configuration must be extended to include `covenantRecords` capability
- The people detail page gains a conditional tab that must be hidden when the capability is off
- Test coverage must verify the access gate for `notes` field (never visible to subject person)

**Safer:**
- Pastoral `notes` are access-gated above student/faculty visibility
- The covenant_fields JSONB structure prevents accidental PII storage (no free-text "email" or "SSN" field names exist in the schema)
- Audit logging on notes changes preserves accountability

**Riskier:**
- JSONB field structure means field-level validation must be enforced at the application layer, not the database layer — this is a known trade-off for configurability

---

## Alternatives Considered

**Fixed columns for each spiritual field:** Rejected. The set of fields varies significantly by tradition (Reformed vs. Pentecostal vs. Catholic vs. Baptist). JSONB with a validated key set is more flexible while still being typed.

**Extending Ministry Formation Records:** Rejected. Ministry Formation (ADR-0045) covers institutional credentials (ordination, denomination membership). Covenant Records cover personal spiritual journey data. They serve different purposes and different audiences.

**Free-text notes only:** Rejected. Free-text is already available through advisor notes. The value of the Covenant Record is structured, filterable, ShepherdAI-signalable data. Without structured fields the feature is not differentiating.

---

## Review Notes

- **Product boundary:** New table, new mutation file, one new tab in the people detail page. No LMS interaction.
- **Security/privacy:** `notes` field access restriction is critical and must be enforced at the module layer, not just the UI. Test must verify students cannot read their own `notes` field.
- **Testing:** Success case, capability-disabled rejection, cross-tenant rejection, notes-access guardian rejection.
- **Rollback:** The `academy_covenant_records` table can be dropped without affecting any other table. The capability flag makes it inert without a migration rollback.
