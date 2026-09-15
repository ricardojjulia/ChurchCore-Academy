# Council Review III — Synthesis & Implementation Plan

**Date:** 2026-06-18  
**Agents:** 4 parallel (read-only)  
**Scope:** Full post-Council-II state audit — routes, UX, SIS completeness, competitive position

---

## Council Participants

| Agent | Role | Key Output |
|-------|------|------------|
| Agent 1 | Full SIS state audit (73 tables, modules, API routes, seed data) | RLS gaps, ShepherdAI not wired, no role enforcement on pages |
| Agent 2 | Route & page audit (nav links, 404s, API coverage) | 4 dead nav links, complete API coverage, legacy redirects |
| Agent 3 | UX / shell audit (ARIA, loading, errors, mobile, CSS) | No error.tsx anywhere, no loading states, sidebar not mobile-accessible |
| Agent 4 | Feature completeness & competitive analysis | MVP score 48/100, faculty at 35%, guardian at 10%, ShepherdAI at 15% |

---

## ADRs Issued by This Council

| ADR | Title | Status |
|-----|-------|--------|
| ADR-0025 | Page Error Boundary and Loading State Strategy | Accepted |
| ADR-0026 | Faculty Operational Portal Model | Accepted |

---

## Cross-Agent Consensus Findings

### CRITICAL (All agents agree — blocks any real user)

1. **4 dead nav links produce 404s** — `/faculty/sections`, `/faculty/roster`, `/admin/admissions/decisions`, `/admin/admissions/matriculation` are in nav but have no pages. Agent 2 confirmed all four.

2. **No error.tsx at any level** — auth failures, DB timeouts, and RLS violations produce a blank Next.js error screen. No recovery path. Agent 3 flagged; Agent 1 confirmed no error module. ADR-0025 issued.

3. **Faculty portal is 35% complete** — teachers cannot view their own sections, cannot access their roster, and grade entry requires admin shell navigation. Agent 2 confirmed missing pages; Agent 4 scored it. ADR-0026 issued.

### HIGH (2+ agents agree — blocks adoption)

4. **No loading states or skeletons** — heavy pages fetch parallel queries with no loading UI. Users see blank screens for 1–2 seconds. Agent 3.

5. **Guardian portal at 10%** — data model and relationship queries exist, pages exist, but no self-service portal. Agent 4.

6. **ShepherdAI signals not generated** — consent and trust boundary built, tables exist, but signal detection and scoring are not wired. ShepherdAI is the primary differentiator. Agent 1 and Agent 4.

7. **Admin sidebar not accessible on mobile** — collapses at 1080px with no toggle button. Agent 3.

8. **Missing aria-current on admin/faculty nav** — active items marked only by CSS class, not ARIA. Screen readers cannot identify current page. Agent 3.

### MEDIUM (1 agent — should fix before wider adoption)

9. No print styles for transcripts (Agent 3)
10. ShepherdAI signals/ai_suggestions tables empty — no seed data for demo (Agent 1)
11. No billing or financial aid (Agent 4 — competitive gap)
12. Admissions lead pipeline missing (Agent 4 — 40% complete)

---

## Implementation Prompts

Execute in order. Each prompt must pass `npm test && npm run lint && npm run build` before the next begins.

---

### Prompt A — Error Boundaries and Loading States

**ADR Reference:** ADR-0025
**Priority:** CRITICAL
**Files:**
- `src/app/error.tsx` (NEW)
- `src/app/admin/error.tsx` (NEW)
- `src/app/faculty/error.tsx` (NEW)
- `src/app/student/error.tsx` (NEW)
- `src/app/guardian/error.tsx` (NEW)
- `src/app/admin/loading.tsx` (NEW)
- `src/app/faculty/loading.tsx` (NEW)
- `src/app/student/loading.tsx` (NEW)

**Scope:** Add branded, role-appropriate error boundaries at every protected layout level. Add loading skeletons for admin, faculty, and student routes. Do not expose raw error messages or stack traces. Each error page must offer a "Return to dashboard" link appropriate for the role.

**Work:**
1. Create `src/app/error.tsx` — root fallback, "use client", generic Academy-branded error with link to `/`
2. Create `src/app/admin/error.tsx` — branded for admin context, links back to `/admin`
3. Create `src/app/faculty/error.tsx` — branded for faculty context, links back to `/faculty`
4. Create `src/app/student/error.tsx` — branded for student PWA context, links back to `/student`
5. Create `src/app/guardian/error.tsx` — branded for guardian context, links back to `/guardian`
6. Create `src/app/admin/loading.tsx` — skeleton layout matching admin shell (sidebar + content area placeholders)
7. Create `src/app/faculty/loading.tsx` — skeleton matching faculty shell
8. Create `src/app/student/loading.tsx` — skeleton matching student PWA shell

**Security:** Error components must never render `error.message` or `error.stack` to the DOM. Log errors server-side only.

**Verification:**
- `npm test`
- `npm run lint`
- `npm run build`

---

### Prompt B — Faculty Sections and Roster Pages

**ADR Reference:** ADR-0026
**Priority:** CRITICAL
**Files:**
- `src/app/faculty/sections/page.tsx` (NEW)
- `src/app/faculty/roster/[sectionId]/page.tsx` (NEW)

**Scope:** Implement the two missing faculty nav pages. `/faculty/sections` shows all sections where the current actor is the assigned instructor. `/faculty/roster/[sectionId]` shows the enrolled student list for one section, verifying the actor is that section's instructor before returning data.

**Work:**
1. Create `src/app/faculty/sections/page.tsx`:
   - Call `loadProtectedAcademyDataset()` to resolve actor
   - Query: `SELECT cs.id, cs.section_code, cs.delivery_mode, cs.roster_count, cs.roster_capacity, c.title AS course_title FROM academy_course_sections cs JOIN academy_courses c ON c.id = cs.course_id AND c.tenant_id = cs.tenant_id WHERE cs.tenant_id = $1 AND cs.instructor_person_id::text = $2 ORDER BY cs.section_code`
   - Display as a table: section code, course title, delivery mode, enrollment count/capacity
   - Empty state: "No sections assigned to you this term. Contact your registrar."

2. Create `src/app/faculty/roster/[sectionId]/page.tsx`:
   - Call `loadProtectedAcademyDataset()` to resolve actor + `params.sectionId`
   - First verify: `SELECT instructor_person_id FROM academy_course_sections WHERE id = $1 AND tenant_id = $2` — if `instructor_person_id::text !== actor.userId`, call `notFound()`
   - Query: `SELECT p.display_name, p.email, r.enrollment_status, r.created_at FROM academy_registrations r JOIN academy_people p ON p.id::text = r.student_person_id AND p.tenant_id = r.tenant_id WHERE r.section_id = $1 AND r.tenant_id = $2 ORDER BY p.display_name`
   - Display roster table with status badges
   - Link back to `/faculty/sections`

**Verification:**
- `npm test`
- `npm run lint`
- `npm run build`

---

### Prompt C — Admin Admissions Dead Links

**ADR Reference:** none (routing completeness)
**Priority:** CRITICAL
**Files:**
- `src/app/admin/admissions/decisions/page.tsx` (NEW)
- `src/app/admin/admissions/matriculation/page.tsx` (NEW)

**Scope:** The admin nav has two items pointing to missing pages. Create them as functional views pulling from existing admissions data.

**Work:**
1. Create `src/app/admin/admissions/decisions/page.tsx`:
   - Call `loadProtectedAcademyDataset()`
   - Query applications with status `accepted` or `rejected` and their decision records
   - Display as a filterable table: applicant name, program, decision, decided-at date, deciding staff member
   - Link to the existing application detail page from the applicant name

2. Create `src/app/admin/admissions/matriculation/page.tsx`:
   - Call `loadProtectedAcademyDataset()`
   - Show accepted applications that have been converted to enrollments (join admissions → enrollments)
   - Display: applicant → student conversion, enrollment date, program, section assignments
   - Empty state: "No matriculated students yet. Accept and convert applications in Admissions."

**Verification:**
- `npm test`
- `npm run lint`
- `npm run build`

---

### Prompt D — ARIA aria-current and Mobile Sidebar

**ADR Reference:** ADR-0025 (accessibility is part of resilience)
**Priority:** HIGH
**Files:**
- `src/components/admin-shell.tsx` (EDIT)
- `src/components/faculty-shell.tsx` (EDIT)
- `src/styles/admin.css` (EDIT)

**Scope:** Add `aria-current="page"` to active nav items in admin and faculty shells. Add a mobile hamburger toggle so the sidebar is accessible on screens narrower than 1080px.

**Work:**
1. In `admin-shell.tsx` — on leaf nav `<Link>` elements, add `aria-current={isActive ? "page" : undefined}` where `isActive` is derived from the existing active-path logic
2. In `faculty-shell.tsx` — same pattern
3. In `admin-shell.tsx` — add a hamburger `<button>` that toggles a `sidebarOpen` state; apply `data-sidebar-open` or a CSS class to the layout wrapper
4. In `admin.css` — at `@media (max-width: 1080px)`: sidebar hidden by default, visible when toggle is active; hamburger button visible

**Verification:**
- `npm test`
- `npm run lint`
- `npm run build`

---

### Prompt E — ShepherdAI Signal Wiring

**ADR Reference:** ADR-0022 (LLIS trust boundary)
**Priority:** HIGH
**Files:**
- `src/modules/academic-workflows/evaluate-academic-workflows.ts` (EDIT — verify signals are saved, not just returned)
- `src/app/api/academy/shepherd-ai/evaluate/route.ts` (EDIT or NEW — verify this route triggers signal generation)
- `supabase/migrations/[next].sql` (EDIT — seed 3–5 realistic ShepherdAI signals for demo tenant)

**Scope:** ShepherdAI evaluates signals in memory but does not persist them to `ai_signals` or `ai_suggestions` tables. Wire the evaluation job to write results to the DB and add demo seed data so the faculty and admin signal views show real content.

**Work:**
1. Verify `runAcademicWorkflowEvaluationJob` — does it write to DB or return in-memory only? If in-memory, add DB persistence via `withAcademyDatabaseContext` using existing `ai_signals` / `ai_suggestions` table schema
2. Create the next seed migration with 3–5 realistic signals for the `cca-main` demo tenant: one `faculty_or_course_assignment_imbalance_review`, one `calendar_setup_review`, one `academic_standing_review` — use real section/student IDs from the existing seed
3. Verify the `/admin/workflows` page reads from DB (not from in-memory evaluation result)
4. Write unit tests verifying signal persistence writes correctly

**Security:** Signal records must include `tenant_id`. No cross-tenant signal reads permitted.

**Verification:**
- `npm test`
- `npm run lint`
- `npm run build`

---

## Execution Order & Gates

```
Prompt A  →  npm test && lint && build
Prompt B  →  npm test && lint && build
Prompt C  →  npm test && lint && build
Prompt D  →  npm test && lint && build   (independent of B & C, can run after A)
Prompt E  →  npm test && lint && build   (independent of B, C, D)
```

Prompts B, C, and D are independent of each other. After Prompt A is merged, B/C/D can be worked in parallel.

---

## Council Assessment — Honest State of the Product

**MVP readiness: 48/100**

The architecture is genuinely excellent — clean domain model, real multi-tenant isolation, working auth, solid LMS integration contracts. The codebase does not carry technical debt in the places that matter most (auth, data access, type safety).

The product gaps are operational, not architectural:
- Faculty cannot do their jobs from the faculty portal
- Admissions has dead nav items
- No error recovery anywhere
- ShepherdAI — the differentiator — is not connected to its own DB tables

The next 5 prompts (A–E) fix the critical blockers without new migrations or new domain logic. After those, the software is functional for a supervised beta pilot. Full competitive readiness requires billing, a complete admissions pipeline, and the guardian portal — those are the next council's agenda.
