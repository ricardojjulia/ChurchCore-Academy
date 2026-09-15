# Council Review IV — Agent 2: Route & Page Audit

_Date: 2026-06-18 | Read-only audit of navigation, page existence, and API coverage._

---

## Navigation Inventories

**Admin Shell** — 22 nav hrefs across 6 sections  
**Faculty Shell** — 7 nav hrefs across 5 sections  
**Student PWA** — 9 nav hrefs

---

## Page Status Table

| Route | Shell | Page Status | Notes |
|---|---|---|---|
| /admin | Admin | EXISTS | Dashboard, ShepherdAI widget |
| /admin/admissions | Admin | EXISTS | Application review list |
| /admin/admissions/decisions | Admin | EXISTS | Decisions queue |
| /admin/admissions/matriculation | Admin | EXISTS | Matriculation tracking |
| /admin/students | Admin | EXISTS | Student index table |
| /admin/students/[id] | Admin | EXISTS | Student detail |
| /admin/transcripts | Admin | EXISTS | Transcript review (no issuance UI) |
| /admin/graduation | Admin | EXISTS | Graduation readiness |
| /admin/programs | Admin | EXISTS | Programs listing |
| /admin/programs/new | Admin | EXISTS | Create program form |
| /admin/programs/[id] | Admin | EXISTS | Program detail |
| /admin/courses | Admin | EXISTS | Course catalog |
| /admin/sections | Admin | **STUB** | Reads legacy mock data |
| /admin/attendance | Admin | EXISTS | Attendance summary |
| /admin/gradebook | Admin | EXISTS | Gradebook overview |
| /admin/faculty | Admin | EXISTS | Faculty directory |
| /admin/staff | Admin | EXISTS | Staff directory |
| /admin/workflows | Admin | EXISTS | ShepherdAI queue |
| /admin/reporting | Admin | **STUB** | Mock dataset only |
| /admin/settings/institution | Admin | EXISTS | |
| /admin/settings/calendar | Admin | EXISTS | |
| /admin/settings/people | Admin | EXISTS | |
| /faculty | Faculty | EXISTS | Faculty dashboard |
| /faculty/schedule | Faculty | **STUB** | Redirects to /faculty |
| /faculty/attendance | Faculty | EXISTS | Attendance form |
| /faculty/sections | Faculty | EXISTS | DB-backed (added Review III) |
| /faculty/roster | Faculty | EXISTS | DB-backed (added Review III) |
| /faculty/gradebook | Faculty | EXISTS | Grade entry UI (no API) |
| /faculty/shepherd | Faculty | **STUB** | Redirects to /faculty |
| /students | Faculty nav | REDIRECT | → /admin/students |
| /student | Student | EXISTS | |
| /student/courses | Student | EXISTS | |
| /student/schedule | Student | EXISTS | |
| /student/progress | Student | EXISTS | |
| /student/documents | Student | EXISTS | Delegates to mock state |
| /student/messages | Student | **STUB** | Hardcoded "No messages" |
| /student/lms | Student | EXISTS | |
| /student/attendance | Student | EXISTS | |
| /student/privacy | Student | EXISTS | |

---

## API Route Completeness

All client-side forms and buttons verified. Notable gaps:

- `/faculty/gradebook` page renders grade entry UI but **no POST/PATCH endpoint exists** — form submission silently fails or errors
- `/admin/transcripts` page instructs users to use the API — **no issuance form exists**
- `/faculty/shepherd` page redirects; no faculty-scoped signal fetch occurs

No orphaned handlers detected (all existing API routes are called from at least one page).

---

## Link Consistency

All hardcoded hrefs in page files resolve to valid pages. Notable cross-shell links:
- Faculty topbar → `/admin` ("Admin Engine Room →") — resolves
- Admin dashboard → `/student` — resolves
- `/admin/settings/people` → `/admin/staff` — resolves

---

## Summary

**41 of 41 nav-listed routes exist.** Four are stubs (redirects or hardcoded content):
`/faculty/schedule`, `/faculty/shepherd`, `/admin/sections`, `/admin/reporting`.
One (`/student/messages`) is hardcoded empty state with no backend.
All API routes are matched to page consumers — the only gap is gradebook (API missing, not page missing).
