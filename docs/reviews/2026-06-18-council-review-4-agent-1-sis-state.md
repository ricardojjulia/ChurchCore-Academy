# Council Review IV — Agent 1: SIS State Audit

_Date: 2026-06-18 | Read-only audit of migrations, modules, API routes, and seed data._

---

## 1. Migrations — 34+ Tables Audited

All 30 migration files span 2026-04-24 → 2026-06-18.

**All tenant-scoped tables have RLS except:**

| Table | RLS | Issue |
|---|---|---|
| `academy_tenant_registry` | None | Cross-tenant data; no policies |
| `academy_platform_role_assignments` | None | Cross-tenant data; no policies |
| `academy_platform_user_preferences` | None | No policies |
| `academy_platform_audit_events` | None | No policies |
| `academy_student_number_sequences` | None | No policies |
| `hq_sessions` | None | No module; orphan |

**Legacy stub tables still present (conflict with normalized schema):**

- `academy_programs` — shadowed by `academy_academic_programs`
- `academy_admin_users` — shadowed by `academy_staff_profiles`
- `academy_students` — shadowed by `academy_student_profiles`
- `academy_faculty` — shadowed by `academy_staff_profiles`
- `academy_sections` — shadowed by `academy_course_sections`
- `academy_thresholds` — ShepherdAI config only, no module type

`academy-data/server-dataset.ts` still reads the legacy stubs, not the normalized tables.

---

## 2. Modules Status

| Module | types.ts | postgres-repository | __tests__ | API route |
|---|---|---|---|---|
| academic-calendar | ✓ | ✓ | ✓ | ✓ |
| academic-programs | ✓ | ✓ | ✓ | ✓ |
| academic-workflows | — | repository.ts | ✓ | ✓ |
| academy-auth | — | postgres-identity-repository.ts | ✓ | indirect |
| academy-config | ✓ | ✓ | ✓ | ✓ |
| academy-data | ✓ | ✓ | ✓ | (internal) |
| admissions | ✓ | ✓ | ✓ | ✓ |
| attendance | ✓ | ✓ | ✓ | ✓ |
| audit | ✓ | ✓ | ✓ | — |
| course-catalog | ✓ | ✓ | ✓ | ✓ |
| course-registration | ✓ | ✓ | ✓ | ✓ |
| demo-feedback | ✓ | ✓ | ✓ | ✓ |
| enrollment-conversion | ✓ | ✓ | ✓ | ✓ |
| **gradebook** | ✓ | ✓ | ✓ | **NONE** |
| grading-records | ✓ | ✓ | ✓ | ✓ |
| learner-intelligence | ✓ | ✓ | ✓ | ✓ |
| lms-contract | — | — | ✓ | ✓ |
| people | — | — | ✓ | ✓ |
| platform-admin | ✓ | ✓ | ✓ | ✓ |
| **scheduled-jobs** | — | — | **NONE** | none |
| shepherd-ai | ✓ | ✓ | ✓ | ✓ |
| student-pwa | — | — | ✓ | ✓ |
| transcripts | — | ✓ | ✓ | ✓ |

**Critical flags:** gradebook has 5 tables, a postgres-repository, and seed data but zero API routes. `scheduled-jobs` has no tests and no cron wiring.

---

## 3. API Routes — 47 endpoints

All routes under `/src/app/api/`. Key gaps:

- **No `/api/academy/gradebook/*`** — grade entry, assignment lookup, course summary all unreachable
- No `/api/academy/graduation/*` — graduation eligibility confirmation is UI-only (read-only page)

---

## 4. App Pages — Stubs and Redirects

Genuine stubs (minimal/hardcoded content):
- `/student/messages/page.tsx` — hardcoded "No messages", no backend
- `/admin/sections/page.tsx` — reads from legacy mock academy-data
- `/admin/reporting/page.tsx` — reads from mock dataset; no real queries
- `/faculty/schedule/page.tsx` — redirects to `/faculty`
- `/faculty/shepherd/page.tsx` — redirects to `/faculty`

---

## 5. Seed Data — Assessment

**Realistic and multi-mode.** 6 seed migrations cover institution, calendar, courses, personas, enrollment chains, gradebook samples, and ShepherdAI signals. Structure is production-shaped.

**Missing:**
- Guardian auth account (Marisol Rivera has relationship but no `auth.users` link)
- No attendance records — attendance module is empty on first view
- No advisor interactions seeded
- No children's school or seminary academic programs in `academy_academic_programs`
- ShepherdAI seed has 5 signals (added in Review IV sprint) but no faculty load signal

---

## 6. Top 5 MVP Gaps

1. **Gradebook has no API surface** — 5 schema tables, full repository, seed data, but zero routes. Faculty cannot grade.
2. **Legacy stub tables still drive the UI** — admin surfaces read denormalized mocks, not real SIS data.
3. **Platform-admin tables have no RLS** — cross-tenant identity data is accessible without row-level policies.
4. **No student-facing grade read path** — `academy_gradebook_records` and `academy_gradebook_course_summaries` exist but are never queried for the student PWA.
5. **`scheduled-jobs` has no tests or runtime trigger** — ShepherdAI signals stay stale in production; no mechanism keeps the queue current.
