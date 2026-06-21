# Council Review IV — Synthesis

**Date:** 2026-06-18  
**Previous review:** Council Review III (2026-06-18, same sprint)  
**MVP Score:** 42/100 (Agent 4 competitive benchmark vs. Populi/Orbund/Jenzabar)  
**Score note:** Review III scored 48/100. Review IV applied a stricter competitive SIS benchmark. The absolute implementation quality has improved (error boundaries, DB-backed faculty pages, ShepherdAI DB persistence, mobile sidebar — all from Review III prompts A–E). The score gap reflects that billing, student registration, and compliance reporting remain entirely absent.

---

## Agent Reports

- [Agent 1 — SIS State Audit](2026-06-18-council-review-4-agent-1-sis-state.md)
- [Agent 2 — Route & Page Audit](2026-06-18-council-review-4-agent-2-routes.md)
- [Agent 3 — UX & Shell Audit](2026-06-18-council-review-4-agent-3-ux.md)
- [Agent 4 — Feature & Competitive Audit](2026-06-18-council-review-4-agent-4-competitive.md)

---

## Cross-Agent Consensus

Items flagged independently by 2 or more agents — highest priority:

| Finding | Agents | Severity |
|---|---|---|
| Gradebook has zero API routes — faculty cannot grade | 1, 2, 4 | Critical |
| Faculty schedule and shepherd pages redirect to /faculty | 2, 4 | Critical |
| Platform-admin tables have no RLS policies | 1 | Critical (security) |
| Transcript issuance requires API access — no UI | 3, 4 | High |
| No print styles — browser print renders full shell | 3, 4 | High |
| No sub-route loading.tsx — blank shell between navigations | 3 | Medium |
| ARIA violation: button[role="option"] in admin search | 3 | Medium |
| Legacy stub tables still drive /admin/sections and /admin/reporting | 1, 2 | Medium |

---

## ADRs Issued

- **[ADR-0027](../adr/0027-platform-admin-rls-strategy.md)** — Platform-admin tables must have restrictive RLS denying anon/authenticated; all access through service-role only.
- **[ADR-0028](../adr/0028-gradebook-api-route-contract.md)** — All grade reads/writes must flow through authenticated API routes; faculty access scoped to owned sections; student access scoped to own records.
- **[ADR-0029](../adr/0029-official-records-print-export-strategy.md)** — `@media print` CSS hides shell chrome on record pages; transcript issuance UI added to admin; server-side PDF deferred.

---

## Implementation Prompts

### Prompt A — Platform-Admin RLS Migration

**ADR Reference:** ADR-0027  
**Files:** `supabase/migrations/20260618020000_platform_admin_rls.sql`  
**Scope:** Add restrictive RLS policies to the 6 platform-admin tables that currently have no row-level security. These tables hold cross-tenant identity data and must deny all `anon` and `authenticated` role access. Service-role access (used by all API routes) is unaffected.

**Work:**
1. Create migration `20260618020000_platform_admin_rls.sql`.
2. For each of: `academy_tenant_registry`, `academy_platform_role_assignments`, `academy_platform_user_preferences`, `academy_platform_audit_events`, `academy_student_number_sequences`, `hq_sessions`:
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
   - `CREATE POLICY "deny_all_non_service_role" ON ... AS RESTRICTIVE FOR ALL TO authenticated, anon USING (false);`
3. Verify that all existing API routes that touch these tables use `getDatabasePool()` (service-role key), not the Supabase authenticated client. If any use the authenticated client, migrate them to the service-role pool.

**Security check:** After applying, verify that a Supabase authenticated client call directly to `academy_tenant_registry` returns 0 rows (not the full table).

**Verification:**
- `npm test` — no test failures
- `npm run lint`
- `npm run build`

---

### Prompt B — Gradebook API Routes

**ADR Reference:** ADR-0028  
**Files:**
- `src/app/api/academy/gradebook/assignments/route.ts` (GET, POST)
- `src/app/api/academy/gradebook/assignments/[id]/route.ts` (PATCH)
- `src/app/api/academy/gradebook/submissions/route.ts` (GET, POST)
- `src/app/api/academy/gradebook/submissions/[id]/route.ts` (PATCH)
- `src/app/api/academy/gradebook/records/route.ts` (GET)
- `src/modules/gradebook/__tests__/api-gradebook-routes.test.ts`

**Scope:** Create 5 route files that expose the existing `GradebookPostgresRepository` over HTTP. Routes must enforce: tenant isolation, section ownership for faculty, and student-scoped read access for grade records.

**Work:**
1. Read `src/modules/gradebook/postgres-repository.ts` to understand available repository methods.
2. Create `assignments/route.ts`:
   - GET: `?sectionId=` required; verify `section.tenant_id = actor.tenantId` and (for faculty) `section.primary_instructor_id = actor.userId`.
   - POST: create assignment; same ownership check.
3. Create `assignments/[id]/route.ts`:
   - PATCH: update title, maxScore, weight, dueDate; same ownership check.
4. Create `submissions/route.ts`:
   - GET: `?assignmentId=` required; ownership check via assignment → section.
   - POST: upsert a grade submission for a student; faculty only.
5. Create `submissions/[id]/route.ts`:
   - PATCH: grade override with required `overrideNote`; faculty/admin only; audit event.
6. Create `records/route.ts`:
   - GET: `?sectionId=` for faculty/admin; `?studentPersonId=actor.userId` enforced for student role.
7. Write tests: success case, cross-tenant rejection, section-ownership rejection (faculty), student-scoped read enforcement.

**Security check:** A faculty actor for section A must receive 403 when querying section B's grades. A student actor must only receive their own records.

**Verification:**
- `npm test` (all new tests must pass)
- `npm run lint`
- `npm run build`

---

### Prompt C — Transcript Issuance UI

**ADR Reference:** ADR-0029  
**Files:** `src/app/admin/transcripts/page.tsx`  
**Scope:** Replace the current API-instruction message with a real issuance form. Staff select a student and delivery method; the form POSTs to the existing `/api/academy/transcripts` route. Issued transcripts appear in the table below.

**Work:**
1. Read the existing `/admin/transcripts/page.tsx` and `/api/academy/transcripts/route.ts` to understand current shape.
2. Add a "Issue Transcript" section above the issued-transcripts table:
   - Student selector: `<select>` populated from `dataset.students` (name + ID).
   - Delivery method: `<select>` with options `digital_download`, `email`, `print`.
   - Recipient email field: shown only when delivery = `email`.
   - Submit button: POSTs to `/api/academy/transcripts`.
3. On success, reload the issued transcripts list or append the new row.
4. On error, show inline error message (never raw DB error).
5. Wrap in a `<Card>` using the existing `.ops-form-*` CSS classes.
6. No new dependencies.

**Security check:** The existing route already verifies actor is admin or registrar and enforces `tenant_id`. The UI must not bypass this — it posts through the normal fetch path.

**Verification:**
- `npm test`
- `npm run lint`
- `npm run build`

---

### Prompt D — Faculty Schedule and Shepherd Pages

**ADR Reference:** ADR-0026 (faculty operational portal model)  
**Files:**
- `src/app/faculty/schedule/page.tsx`
- `src/app/faculty/shepherd/page.tsx`

**Scope:** Both pages currently redirect to `/faculty`. Replace with real server-side pages. Schedule shows today's assigned sections from the DB. Shepherd shows faculty-scoped ShepherdAI suggestions from `ai_suggestions`.

**Work:**

**`/faculty/schedule/page.tsx`:**
1. Use `withAcademyDatabaseContext` to query `academy_course_sections` joined with `academy_courses` where `primary_instructor_id = actor.userId` and `tenant_id = actor.tenantId`.
2. Include `schedule_pattern`, `delivery_mode`, `section_code`, `course_title`, `status`.
3. Render a `<FacultyShell>` with a table of today's or this-term's sections sorted by `schedule_pattern`.
4. Empty state: "No sections scheduled. Contact your registrar if you expect to see sessions here."
5. No `activeSection` prop (not accepted by FacultyShell).

**`/faculty/shepherd/page.tsx`:**
1. Use `withAcademyDatabaseContext` to query `ai_suggestions` where `tenant_id = actor.tenantId` and `entity_type IN ('faculty', 'course_section')` and `entity_id` matches sections owned by this faculty member (subquery: `select id from academy_course_sections where primary_instructor_id = $actor.userId and tenant_id = $tenantId`).
2. Render a `<FacultyShell>` with a list of suggestions including title, summary, urgency badge, and boundary_note.
3. Empty state: "No academic workflow suggestions for your sections at this time."
4. Cast query result as `{ rows: SuggestionRow[] }` (no generic on `client.query()`).

**Security check:** Faculty may only see suggestions for sections they own. The subquery must enforce `primary_instructor_id = actor.userId AND tenant_id = actor.tenantId`.

**Verification:**
- `npm test`
- `npm run lint`
- `npm run build`

---

### Prompt E — Sub-route Loading Skeletons + ARIA Fix

**ADR Reference:** ADR-0025 (page error boundary and loading state strategy)  
**Files:**
- `src/app/admin/students/loading.tsx`
- `src/app/admin/admissions/loading.tsx`
- `src/app/admin/programs/loading.tsx`
- `src/app/admin/workflows/loading.tsx`
- `src/app/faculty/sections/loading.tsx`
- `src/app/faculty/gradebook/loading.tsx`
- `src/components/admin-shell.tsx` (ARIA fix)

**Scope:** Add `loading.tsx` at 6 key sub-route segments so users see a skeleton rather than a blank shell during navigation. Also fix the `button[role="option"]` ARIA violation in the admin search dropdown.

**Work:**

**Loading files (6):**
1. Each file must be a server component (no `"use client"`).
2. Each must render a skeleton that approximates the target page's layout using existing `.ops-skeleton`, `.ops-loading-*` CSS classes from `admin.css` and `faculty-shell` classes.
3. For list/table pages (`students`, `admissions`, `programs`, `workflows`, `sections`): render `.ops-loading-shell` with `.ops-loading-table`.
4. For gradebook: render `.ops-loading-shell` with `.ops-loading-stats` (3 cards) and `.ops-loading-table`.
5. No new CSS required — all classes already exist in `admin.css`.

**ARIA fix in `admin-shell.tsx`:**
1. At lines 315–319, change `<button role="option">` to `<div role="option" tabIndex={0}` with keyboard handlers (`onKeyDown` for Enter/Space triggering the same `onClick` callback). This makes the option a non-button element with keyboard accessibility, satisfying the ARIA spec for `role="option"` inside `role="listbox"`.

**Verification:**
- `npm test`
- `npm run lint`
- `npm run build`

---

### Prompt F — Print Styles for Official Records

**ADR Reference:** ADR-0029  
**Files:**
- `src/styles/admin.css` (add `@media print` block)
- `src/styles/student-pwa.css` (add `@media print` block)

**Scope:** Add print stylesheets that hide all navigation chrome so any admin or student PWA record page produces clean output when printed. Tables must not break across pages.

**Work:**

**`admin.css` — add at end:**
```css
@media print {
  .admin-sidebar,
  .admin-topbar,
  .admin-mobile-menu-toggle,
  .admin-search-wrapper,
  .admin-context-banner,
  .admin-page-action-link,
  .ops-page-action-link,
  button,
  [class*="-actions"],
  [class*="-retry"],
  [class*="-home"] {
    display: none !important;
  }

  .admin-app {
    display: block;
  }

  .admin-main {
    width: 100%;
  }

  .admin-content {
    padding: 0;
  }

  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 4px 8px; font-size: 11pt; }
  tr { page-break-inside: avoid; }
}
```

**`student-pwa.css` — add at end:**
```css
@media print {
  .student-pwa-nav,
  .student-pwa-bottom-nav,
  .student-pwa-topbar,
  button,
  [class*="-actions"] {
    display: none !important;
  }

  .student-pwa-main {
    padding: 0;
    width: 100%;
  }

  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 4px 8px; font-size: 11pt; }
  tr { page-break-inside: avoid; }
}
```

**Verification:**
- `npm test`
- `npm run lint`
- `npm run build`
- Manual: browser print preview of `/admin/transcripts` should show only content area, no sidebar or topbar.

---

## Execution Order

```
Prompt A (RLS migration)          — independent; run first (security)
Prompt B (gradebook API)          — independent; can run in parallel with C, D
Prompt C (transcript UI)          — independent; can run in parallel with B, D
Prompt D (faculty schedule/shepherd) — independent; can run in parallel with B, C
Prompt E (loading skeletons + ARIA)  — independent; can run after A
Prompt F (print styles)           — independent; can run any time
```

**All 6 prompts are independent of each other. They can be run in parallel. Run gate (`npm test && npm run lint && npm run build`) after each.**

---

## Post-Review Notes

Items identified but deferred (below MVP threshold for this sprint):

- Legacy stub tables (`academy_students`, `academy_faculty`, etc.) still drive `/admin/sections` and ShepherdAI evaluation. Migrating `academy-data/server-dataset.ts` to read from normalized tables is a larger refactor requiring its own sprint and spec.
- Guardian auth account (Marisol Rivera) has no seeded Supabase auth.users link — guardian portal will redirect to login. Deferred to guardian portal sprint.
- ShepherdAI scheduled evaluation job has no cron trigger. Deferred to Phase 10 ShepherdAI Expansion sprint.
- Student self-service registration is a Tier 1 competitive gap but requires schema design for add/drop rules, holds, and capacity enforcement — deferred to its own sprint.
- Billing and financial operations are entirely absent — Tier 1 competitive gap, deferred to Phase 12.
