# ADR-0058 — Compliance and Institutional Reporting: IPEDS Subset and Scheduled Delivery

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`

---

## Context

The reporting module produces 5 report types with CSV export. No IPEDS-formatted output exists, and
reports cannot be scheduled for automatic delivery. Institutions that report to IPEDS (Integrated
Postsecondary Education Data System) currently must manually assemble data from the existing CSV exports.

**Wildcard condition from Council Review X:** IPEDS certification requires institution-specific UNITID
numbers, CIP (Classification of Instructional Programs) codes for each program, and federal enrollment
definitions that depend on how the institution classifies part-time vs full-time status. This ADR scopes
the IPEDS output to a best-effort subset and explicitly calls out what is blocked on institution
configuration data. No promise of IPEDS certification is made.

---

## Decision

### 1. IPEDS best-effort subset

The reporting module adds an IPEDS export that produces a structured JSON/CSV matching the IPEDS
Institutional Characteristics (IC) and Fall Enrollment (EF) components — the two most commonly filed
surveys. The output is labeled "IPEDS-formatted (review required)" and includes a disclaimer:
"Review this export with your IPEDS data preparer before submission. ChurchCore Academy does not
certify IPEDS compliance."

**Included fields (best-effort):**

*IC component:*
- Institution name, address (from `InstitutionProfile`)
- Institution type (maps Academy `primaryMode` to IPEDS sector codes)
- Total enrollment (headcount)
- Student-to-faculty ratio (computed from active registrations and instructor assignments)

*EF component:*
- Total fall enrollment by level (undergraduate, graduate, certificate)
- Enrollment by attendance status (full-time vs part-time) — **requires** institution to configure
  `full_time_credit_hours_threshold` in institution settings
- Enrollment by race/ethnicity (only if institution has collected and stored this voluntary field)

**Blocked (not included until institution configuration is complete):**
- UNITID — must be entered by admin in institution settings
- CIP codes — must be assigned per program by admin
- Retention and graduation rates — require longitudinal cohort tracking (future feature)
- Financial data components — require Stripe/federal aid completion

### 2. Scheduled report delivery

Add `academy_scheduled_reports` table:

- `id`, `tenant_id`
- `report_type`: `enrollment_summary` | `attendance_summary` | `grade_summary` | `financial_summary` | `ipeds_export`
- `frequency`: `weekly` | `monthly` | `term_end`
- `delivery_method`: `email` | `download_link`
- `recipients` — JSON array of email addresses (admins/registrars only)
- `format`: `csv` | `json`
- `next_run_at`
- `last_run_at`
- `active`: boolean

A Vercel Cron job (`/api/cron/scheduled-reports`, runs daily at 04:00 UTC) queries all active
scheduled reports whose `next_run_at ≤ now()`, generates the report, and:
- For `email` delivery: enqueues an email via the communications queue (ADR-0040) with a
  secure download link (signed URL, 24-hour expiry). **No PII is included in the email body.**
- For `download_link` delivery: stores the report in Supabase Storage and emails a link.

Generated report files are stored in `academy-reports` private bucket at:
`{tenant_id}/scheduled/{report_type}/{YYYY-MM-DD}/{uuid}.{format}`

Reports are retained for 90 days, then deleted by a separate cleanup cron.

### 3. Institution IPEDS configuration

Add optional fields to `InstitutionProfile`:

- `ipeds_unitid` — string (8 digits), optional
- `full_time_credit_hours_threshold` — integer (default 12 for semesters, 9 for quarters)
- `programs[].cip_code` — per-program CIP code assignment

These fields are managed at `/admin/settings/compliance`.

### 4. Admin UI

- `/admin/reporting` — existing report surfaces plus IPEDS export tab
- IPEDS export tab: institution configuration status (UNITID set? CIP codes assigned?), export button,
  disclaimer banner, download link
- Scheduled reports tab: list of scheduled reports with frequency, recipients, last run, next run,
  enable/disable toggle
- "New scheduled report" modal: report type, frequency, format, delivery method, recipients

### 5. API routes

- `GET /api/academy/reporting/ipeds` — generates and returns IPEDS export (admin role)
- `GET /api/academy/reporting/scheduled` — list scheduled reports (admin role)
- `POST /api/academy/reporting/scheduled` — create scheduled report (admin role)
- `PATCH /api/academy/reporting/scheduled/[id]` — edit/disable scheduled report (admin role)
- `DELETE /api/academy/reporting/scheduled/[id]` — delete scheduled report (admin role)

---

## Consequences

- Institutions have a starting point for IPEDS submission preparation.
- Scheduled reports reduce manual reporting burden for recurring operational summaries.
- The "review required" disclaimer protects ChurchCore Academy from IPEDS certification liability.
- UNITID and CIP code configuration gates ensure institutions cannot accidentally submit incomplete data.

---

## Alternatives Considered

**Full IPEDS certification guarantee:**
Rejected. IPEDS compliance requires institution-specific data (UNITID, CIP codes, federal enrollment
definitions) that varies per institution and cannot be certified by the system alone. A best-effort
export with a required review disclaimer is the correct boundary.

**Separate compliance reporting service:**
Rejected. The reporting module is the correct domain owner. A separate service would add operational
complexity without domain isolation benefit.

---

## Security / Privacy Review Notes

- Scheduled report emails must not include student PII. Email contains only a secure download link.
- Report files in storage must be tenant-scoped and accessible only to admin/registrar roles.
- UNITID and CIP codes are institution configuration, not student PII, but should still be treated
  as sensitive institution data (not surfaced in public API responses).
- Report generation routes must enforce admin/registrar role for the tenant.

---

## Related

- ADR-0029 — Official records print and export strategy
- ADR-0036 — Regulated/federal aid activation boundary (IPEDS financial components blocked until complete)
- ADR-0040 — Email delivery provider (scheduled report email delivery)
