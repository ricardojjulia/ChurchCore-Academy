# Role Matrix Acceptance Checklist

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`  
Executable inventory: `src/modules/acceptance/role-matrix.ts`

## Status

This checklist is the ADR-0038 Prompt 1 acceptance artifact. It defines the controlled-pilot role matrix and the smoke evidence expected for protected pages and APIs.

Authenticated browser walkthrough harness: `docs/acceptance/authenticated-role-walkthrough-evidence.md`.

Live tenant walkthrough screenshots and console-error evidence remain required before a production or general-availability claim.

## Role Profiles

| Role | Runtime mapping | Required surfaces | Forbidden surfaces | Data boundary |
| --- | --- | --- | --- | --- |
| Admin | `institution_admin` | `/admin`, `/admin/settings/institution`, `/admin/students`, `/admin/reporting` | `/platform/control` | Tenant-scoped institutional operations through verified session and tenant database context. |
| Registrar | `registrar` | `/admin/sections`, `/admin/students`, `/admin/transcripts`, `/api/academy/registrations` | `/platform/control` | Tenant registrar records only. |
| Faculty | `faculty` | `/faculty`, `/faculty/attendance`, `/faculty/gradebook`, `/api/academy/attendance` | `/admin/billing`, `/admin/financial-aid`, `/platform/control` | Assigned instructional sections and grade-entry queues only. |
| Student | `student` | `/student`, `/student/courses`, `/student/schedule`, `/student/account`, `/student/documents` | `/admin`, `/faculty`, `/platform/control` | Authenticated learner self-service records only. |
| Guardian | `guardian` | `/guardian`, `/guardian/messages` | `/admin`, `/faculty`, `/student`, `/platform/control` | Active guardian relationships and category visibility grants only. |
| Finance | `finance` | `/admin/billing`, `/admin/financial-aid`, `/api/academy/billing`, `/api/academy/financial-aid` | `/faculty/gradebook`, `/platform/control` | Tenant student-account ledger and institutional-aid workflows only. |
| Admissions | `admissions` | `/admin/admissions`, `/admin/admissions/decisions`, `/api/academy/admissions/applications` | `/admin/billing`, `/faculty/gradebook`, `/platform/control` | Tenant admissions pipeline and accepted-application conversion only. |
| Platform admin | `platform_admin` | `/platform/control`, `/api/platform/tenants`, `/api/platform/session` | `/admin/billing`, `/student`, `/faculty` | Platform tenant control only unless separately assigned a tenant role. |

## Protected Route Smoke

Unauthenticated page requests should redirect to login. Unauthenticated API requests should reject with authentication failure or protected-route redirect depending on the Next.js proxy path.

| Surface | Type | Expected unauthenticated result | Evidence command |
| --- | --- | --- | --- |
| `/admin` | Page | 302/307 to `/login?next=/admin` | `curl -I http://localhost:3200/admin` |
| `/admin/settings/institution` | Page | 302/307 to `/login?next=/admin/settings/institution` | `curl -I http://localhost:3200/admin/settings/institution` |
| `/admin/students` | Page | 302/307 to `/login?next=/admin/students` | `curl -I http://localhost:3200/admin/students` |
| `/admin/transcripts` | Page | 302/307 to `/login?next=/admin/transcripts` | `curl -I http://localhost:3200/admin/transcripts` |
| `/admin/admissions` | Page | 302/307 to `/login?next=/admin/admissions` | `curl -I http://localhost:3200/admin/admissions` |
| `/admin/admissions/decisions` | Page | 302/307 to `/login?next=/admin/admissions/decisions` | `curl -I http://localhost:3200/admin/admissions/decisions` |
| `/admin/sections` | Page | 302/307 to `/login?next=/admin/sections` | `curl -I http://localhost:3200/admin/sections` |
| `/admin/billing` | Page | 302/307 to `/login?next=/admin/billing` | `curl -I http://localhost:3200/admin/billing` |
| `/admin/financial-aid` | Page | 302/307 to `/login?next=/admin/financial-aid` | `curl -I http://localhost:3200/admin/financial-aid` |
| `/admin/reporting` | Page | 302/307 to `/login?next=/admin/reporting` | `curl -I http://localhost:3200/admin/reporting` |
| `/faculty` | Page | 302/307 to `/login?next=/faculty` | `curl -I http://localhost:3200/faculty` |
| `/student` | Page | 302/307 to `/login?next=/student` | `curl -I http://localhost:3200/student` |
| `/student/courses` | Page | 302/307 to `/login?next=/student/courses` | `curl -I http://localhost:3200/student/courses` |
| `/student/schedule` | Page | 302/307 to `/login?next=/student/schedule` | `curl -I http://localhost:3200/student/schedule` |
| `/guardian` | Page | 302/307 to `/login?next=/guardian` | `curl -I http://localhost:3200/guardian` |
| `/platform/control` | Page | 302/307 to `/login?next=/platform/control` | `curl -I http://localhost:3200/platform/control` |
| `/api/academy/billing` | API | 401 or protected redirect | `curl -i http://localhost:3200/api/academy/billing` |
| `/api/academy/financial-aid` | API | 401 or protected redirect | `curl -i http://localhost:3200/api/academy/financial-aid` |
| `/api/platform/tenants` | API | 401 or protected redirect | `curl -i http://localhost:3200/api/platform/tenants` |
| `/api/platform/session` | API | 401 or protected redirect | `curl -i http://localhost:3200/api/platform/session` |

## Automated Evidence

```bash
node --import tsx --test src/modules/acceptance/__tests__/role-matrix.test.ts
npm run verify:role-walkthrough
npm test
npm run lint
npm run build
```

## Remaining ADR-0038 Evidence

- live tenant authenticated role-by-role browser walkthrough screenshots and console/error capture;
- per-pilot-tenant evidence log approval before expanding controlled-pilot use.
