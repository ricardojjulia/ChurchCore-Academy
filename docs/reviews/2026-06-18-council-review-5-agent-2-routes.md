# Council Review V — Agent 2: Route & Page Audit

_Date: 2026-06-18_

## 1. Nav Inventories

**Admin shell:** `/admin/admissions`, `/admin/admissions/decisions`, `/admin/admissions/matriculation`, `/admin/students`, `/admin/transcripts`, `/admin/graduation`, `/admin/programs`, `/admin/courses`, `/admin/sections`, `/admin/attendance`, `/admin/gradebook`, `/admin/faculty`, `/admin/staff`, `/admin/workflows`, `/admin/reporting`, `/admin/settings/institution`, `/admin/settings/calendar`, `/admin/settings/people`

**Faculty shell:** `/faculty/schedule`, `/faculty/attendance`, `/faculty/sections`, `/faculty/roster`, `/faculty/gradebook`, `/students`, `/faculty/shepherd`

**Student PWA:** `/student`, `/student/courses`, `/student/schedule`, `/student/progress`, `/student/documents`, `/student/messages`, `/student/lms`, `/student/attendance`, `/student/privacy`

## 2. Summary Table

| Route | Shell | Page Status | Notes |
|---|---|---|---|
| `/admin/admissions` | Admin | EXISTS | Real — loads application list |
| `/admin/admissions/decisions` | Admin | EXISTS | 153 lines, real |
| `/admin/admissions/matriculation` | Admin | EXISTS | 202 lines, real |
| `/admin/students` | Admin | EXISTS | 148 lines, real |
| `/admin/transcripts` | Admin | **ARCH VIOLATION** | Uses `loadProtectedAcademyDataset` — violates CLAUDE.md §Architecture |
| `/admin/graduation` | Admin | EXISTS | 214 lines, real |
| `/admin/programs` | Admin | EXISTS | 128 lines, real |
| `/admin/courses` | Admin | EXISTS | 245 lines, real |
| `/admin/sections` | Admin | EXISTS | 75 lines, real |
| `/admin/attendance` | Admin | EXISTS | 169 lines, real |
| `/admin/gradebook` | Admin | EXISTS | 163 lines, real |
| `/admin/faculty` | Admin | EXISTS | 56 lines, real |
| `/admin/staff` | Admin | EXISTS | 148 lines, real |
| `/admin/workflows` | Admin | **ARCH VIOLATION** | Uses `loadProtectedAcademyDataset` — violates CLAUDE.md §Architecture |
| `/admin/reporting` | Admin | EXISTS | 292 lines, real |
| `/admin/settings/institution` | Admin | EXISTS | 187 lines, real |
| `/admin/settings/calendar` | Admin | EXISTS | 282 lines, real |
| `/admin/settings/people` | Admin | EXISTS | 364 lines, real |
| `/faculty/schedule` | Faculty | EXISTS | 144 lines, real |
| `/faculty/attendance` | Faculty | EXISTS | 42 lines, real |
| `/faculty/sections` | Faculty | EXISTS | 147 lines, real |
| `/faculty/roster` | Faculty | EXISTS | 175 lines, real |
| `/faculty/gradebook` | Faculty | EXISTS | 173 lines, real |
| `/students` | Faculty | **STUB** | 4-line redirect to `/admin/students`; no faculty-scoped page |
| `/faculty/shepherd` | Faculty | EXISTS | 163 lines, real |
| `/student` | Student | EXISTS | Delegates to `StudentDashboardView` |
| `/student/courses` | Student | EXISTS | 41 lines, real |
| `/student/schedule` | Student | EXISTS | 51 lines, real |
| `/student/progress` | Student | EXISTS | Delegates to `StudentProgressView` |
| `/student/documents` | Student | EXISTS | Delegates to `StudentDocumentsView` (placeholder) |
| `/student/messages` | Student | EXISTS | 42 lines (placeholder) |
| `/student/lms` | Student | EXISTS | Delegates to `StudentLmsLaunchPanel` |
| `/student/attendance` | Student | EXISTS | 114 lines, real |
| `/student/privacy` | Student | EXISTS | Delegates to `StudentConsentControls` |

## 3. API Route Completeness

All client-side fetch calls map to existing route.ts handlers. No orphaned client fetches.

Notable existing coverage: `POST /api/academy/transcripts`, `POST /api/academy/programs`, `POST /api/academy/gradebook/records`, all workflow action routes, all admissions action routes.

## 4. Architecture Violations

- `/admin/transcripts/page.tsx` — calls `loadProtectedAcademyDataset` at runtime. CLAUDE.md: _"Runtime pages may not import academy-data/mock-data."_
- `/admin/workflows/page.tsx` — same violation.
- `/students` (faculty nav) — cross-surface redirect to admin. Faculty users land in an admin-restricted surface with no faculty access controls.
- `/admin/sections` — contains hardcoded `Link` to `/api/academy/registrations?sectionId=...` (linking directly to an API route from a page).

## 5. Key Findings

**Zero 404s** — every nav href has a `page.tsx`.

**Two architecture violations** that block a production readiness claim: the `loadProtectedAcademyDataset` import in `/admin/transcripts` and `/admin/workflows`.

**Faculty cross-link `/students`** silently drops faculty users into the admin surface — this should either be removed or replaced with a faculty-scoped student list under `/faculty/students`.
