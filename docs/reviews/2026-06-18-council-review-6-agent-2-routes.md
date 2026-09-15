# Council Review VI — Agent 2: Route & Page Audit

_Date: 2026-06-18_

## 1. Nav Inventories

**Admin shell:** 19 routes (unchanged from Council V)
**Faculty shell:** `/faculty/schedule`, `/faculty/attendance`, `/faculty/sections`, `/faculty/roster`, `/faculty/gradebook`, `/students`, `/faculty/shepherd`
**Student PWA:** 9 routes (unchanged)

## 2. Summary Table

All 35 shell-linked routes have a `page.tsx`. Zero 404s.

| Route | Shell | Status | Notes |
|---|---|---|---|
| All `/admin/*` routes (18) | Admin | EXISTS | All functional |
| `/faculty/schedule`, `/faculty/attendance`, `/faculty/sections`, `/faculty/roster`, `/faculty/gradebook`, `/faculty/shepherd` | Faculty | EXISTS | All functional |
| `/students` | Faculty | **STUB** | 4-line `redirect("/admin/students")` — drops faculty user out of faculty shell |
| All `/student/*` routes (9) | Student | EXISTS | All functional |

**ReEvaluateButton now present** on both `/admin/workflows` and `/faculty/shepherd` — ADR-0031 correctly implemented.

## 3. API Route Completeness

All client fetches resolve to existing route handlers. No orphaned API handlers found.
`ReEvaluateButton` → `POST /api/academy/shepherd-ai/evaluate` — confirmed present.

## 4. Link Consistency Issues

- **`/students`** (faculty "All Students") — stub redirect to `/admin/students`. Faculty user exits faculty shell context. Should either be removed from faculty nav or replaced with a `/faculty/students` page.
- **`/workflows`** — top-level stub redirect to `/admin/workflows`. Legacy alias, benign.
- **`/admin/settings/courses`**, **`/admin/settings/grading`**, **`/admin/settings/demo-feedback`** — pages exist and are accessible by direct URL but are not linked from the admin nav. Orphan pages reachable by typing URL only.

## 5. Key Findings

- **Zero 404s.** All nav routes resolved.
- **Zero orphaned API handlers.** All client fetches have a backing route.
- **One navigation inconsistency:** `/students` in faculty nav drops users into admin shell with no back path.
- **Three orphan settings pages** not reachable from nav.
