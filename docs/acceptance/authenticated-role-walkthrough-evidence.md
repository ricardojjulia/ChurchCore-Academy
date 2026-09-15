# Authenticated Role Walkthrough Evidence

Generated: 2026-06-21T19:57:43.389Z
Base URL: http://localhost:3200

## Credential Contract

| Role | Email env | Password env | Seeded default |
| --- | --- | --- | --- |
| admin | `CCA_WALKTHROUGH_ADMIN_EMAIL` | `CCA_WALKTHROUGH_ADMIN_PASSWORD` | `institution.admin@churchcore.academy` |
| registrar | `CCA_WALKTHROUGH_REGISTRAR_EMAIL` | `CCA_WALKTHROUGH_REGISTRAR_PASSWORD` | `registrar@churchcore.academy` |
| faculty | `CCA_WALKTHROUGH_FACULTY_EMAIL` | `CCA_WALKTHROUGH_FACULTY_PASSWORD` | `faculty@churchcore.academy` |
| student | `CCA_WALKTHROUGH_STUDENT_EMAIL` | `CCA_WALKTHROUGH_STUDENT_PASSWORD` | `student@churchcore.academy` |
| guardian | `CCA_WALKTHROUGH_GUARDIAN_EMAIL` | `CCA_WALKTHROUGH_GUARDIAN_PASSWORD` | `guardian@churchcore.academy` |
| finance | `CCA_WALKTHROUGH_FINANCE_EMAIL` | `CCA_WALKTHROUGH_FINANCE_PASSWORD` | `finance@churchcore.academy` |
| admissions | `CCA_WALKTHROUGH_ADMISSIONS_EMAIL` | `CCA_WALKTHROUGH_ADMISSIONS_PASSWORD` | `admissions@churchcore.academy` |
| platform_admin | `CCA_WALKTHROUGH_PLATFORM_ADMIN_EMAIL` | `CCA_WALKTHROUGH_PLATFORM_ADMIN_PASSWORD` | `admin@churchcore.academy` |

## Session Bootstrap Commands

Run the relevant login command before recording that role's route evidence.

| Role | Login command |
| --- | --- |
| admin | `./node_modules/.bin/agent-browser --session cca-admin open http://localhost:3200/login && ./node_modules/.bin/agent-browser --session cca-admin wait 500 && ./node_modules/.bin/agent-browser --session cca-admin find label Email fill "${CCA_WALKTHROUGH_ADMIN_EMAIL:-institution.admin@churchcore.academy}" && ./node_modules/.bin/agent-browser --session cca-admin find label Password fill "${CCA_WALKTHROUGH_ADMIN_PASSWORD:-ChurchCore2026!}" && ./node_modules/.bin/agent-browser --session cca-admin click 'button[type="submit"]' && ./node_modules/.bin/agent-browser --session cca-admin wait 1000` |
| registrar | `./node_modules/.bin/agent-browser --session cca-registrar open http://localhost:3200/login && ./node_modules/.bin/agent-browser --session cca-registrar wait 500 && ./node_modules/.bin/agent-browser --session cca-registrar find label Email fill "${CCA_WALKTHROUGH_REGISTRAR_EMAIL:-registrar@churchcore.academy}" && ./node_modules/.bin/agent-browser --session cca-registrar find label Password fill "${CCA_WALKTHROUGH_REGISTRAR_PASSWORD:-ChurchCore2026!}" && ./node_modules/.bin/agent-browser --session cca-registrar click 'button[type="submit"]' && ./node_modules/.bin/agent-browser --session cca-registrar wait 1000` |
| faculty | `./node_modules/.bin/agent-browser --session cca-faculty open http://localhost:3200/login && ./node_modules/.bin/agent-browser --session cca-faculty wait 500 && ./node_modules/.bin/agent-browser --session cca-faculty find label Email fill "${CCA_WALKTHROUGH_FACULTY_EMAIL:-faculty@churchcore.academy}" && ./node_modules/.bin/agent-browser --session cca-faculty find label Password fill "${CCA_WALKTHROUGH_FACULTY_PASSWORD:-ChurchCore2026!}" && ./node_modules/.bin/agent-browser --session cca-faculty click 'button[type="submit"]' && ./node_modules/.bin/agent-browser --session cca-faculty wait 1000` |
| student | `./node_modules/.bin/agent-browser --session cca-student open http://localhost:3200/login && ./node_modules/.bin/agent-browser --session cca-student wait 500 && ./node_modules/.bin/agent-browser --session cca-student find label Email fill "${CCA_WALKTHROUGH_STUDENT_EMAIL:-student@churchcore.academy}" && ./node_modules/.bin/agent-browser --session cca-student find label Password fill "${CCA_WALKTHROUGH_STUDENT_PASSWORD:-ChurchCore2026!}" && ./node_modules/.bin/agent-browser --session cca-student click 'button[type="submit"]' && ./node_modules/.bin/agent-browser --session cca-student wait 1000` |
| guardian | `./node_modules/.bin/agent-browser --session cca-guardian open http://localhost:3200/login && ./node_modules/.bin/agent-browser --session cca-guardian wait 500 && ./node_modules/.bin/agent-browser --session cca-guardian find label Email fill "${CCA_WALKTHROUGH_GUARDIAN_EMAIL:-guardian@churchcore.academy}" && ./node_modules/.bin/agent-browser --session cca-guardian find label Password fill "${CCA_WALKTHROUGH_GUARDIAN_PASSWORD:-ChurchCore2026!}" && ./node_modules/.bin/agent-browser --session cca-guardian click 'button[type="submit"]' && ./node_modules/.bin/agent-browser --session cca-guardian wait 1000` |
| finance | `./node_modules/.bin/agent-browser --session cca-finance open http://localhost:3200/login && ./node_modules/.bin/agent-browser --session cca-finance wait 500 && ./node_modules/.bin/agent-browser --session cca-finance find label Email fill "${CCA_WALKTHROUGH_FINANCE_EMAIL:-finance@churchcore.academy}" && ./node_modules/.bin/agent-browser --session cca-finance find label Password fill "${CCA_WALKTHROUGH_FINANCE_PASSWORD:-ChurchCore2026!}" && ./node_modules/.bin/agent-browser --session cca-finance click 'button[type="submit"]' && ./node_modules/.bin/agent-browser --session cca-finance wait 1000` |
| admissions | `./node_modules/.bin/agent-browser --session cca-admissions open http://localhost:3200/login && ./node_modules/.bin/agent-browser --session cca-admissions wait 500 && ./node_modules/.bin/agent-browser --session cca-admissions find label Email fill "${CCA_WALKTHROUGH_ADMISSIONS_EMAIL:-admissions@churchcore.academy}" && ./node_modules/.bin/agent-browser --session cca-admissions find label Password fill "${CCA_WALKTHROUGH_ADMISSIONS_PASSWORD:-ChurchCore2026!}" && ./node_modules/.bin/agent-browser --session cca-admissions click 'button[type="submit"]' && ./node_modules/.bin/agent-browser --session cca-admissions wait 1000` |
| platform_admin | `./node_modules/.bin/agent-browser --session cca-platform_admin open http://localhost:3200/login && ./node_modules/.bin/agent-browser --session cca-platform_admin wait 500 && ./node_modules/.bin/agent-browser --session cca-platform_admin find label Email fill "${CCA_WALKTHROUGH_PLATFORM_ADMIN_EMAIL:-admin@churchcore.academy}" && ./node_modules/.bin/agent-browser --session cca-platform_admin find label Password fill "${CCA_WALKTHROUGH_PLATFORM_ADMIN_PASSWORD:-ChurchCore2026!}" && ./node_modules/.bin/agent-browser --session cca-platform_admin click 'button[type="submit"]' && ./node_modules/.bin/agent-browser --session cca-platform_admin wait 1000` |

## Walkthrough Steps

| Role | Route | Type | Expected | Evidence command |
| --- | --- | --- | --- | --- |
| admin | `/admin` | required | loads | `./node_modules/.bin/agent-browser --session cca-admin open http://localhost:3200/admin && ./node_modules/.bin/agent-browser --session cca-admin snapshot -i` |
| admin | `/admin/settings/institution` | required | loads | `./node_modules/.bin/agent-browser --session cca-admin open http://localhost:3200/admin/settings/institution && ./node_modules/.bin/agent-browser --session cca-admin snapshot -i` |
| admin | `/admin/students` | required | loads | `./node_modules/.bin/agent-browser --session cca-admin open http://localhost:3200/admin/students && ./node_modules/.bin/agent-browser --session cca-admin snapshot -i` |
| admin | `/admin/reporting` | required | loads | `./node_modules/.bin/agent-browser --session cca-admin open http://localhost:3200/admin/reporting && ./node_modules/.bin/agent-browser --session cca-admin snapshot -i` |
| admin | `/platform/control` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-admin open http://localhost:3200/platform/control && ./node_modules/.bin/agent-browser --session cca-admin snapshot -i` |
| registrar | `/admin/sections` | required | loads | `./node_modules/.bin/agent-browser --session cca-registrar open http://localhost:3200/admin/sections && ./node_modules/.bin/agent-browser --session cca-registrar snapshot -i` |
| registrar | `/admin/students` | required | loads | `./node_modules/.bin/agent-browser --session cca-registrar open http://localhost:3200/admin/students && ./node_modules/.bin/agent-browser --session cca-registrar snapshot -i` |
| registrar | `/admin/transcripts` | required | loads | `./node_modules/.bin/agent-browser --session cca-registrar open http://localhost:3200/admin/transcripts && ./node_modules/.bin/agent-browser --session cca-registrar snapshot -i` |
| registrar | `/api/academy/registrations` | required | loads | `./node_modules/.bin/agent-browser --session cca-registrar open http://localhost:3200/api/academy/registrations && ./node_modules/.bin/agent-browser --session cca-registrar snapshot -i` |
| registrar | `/platform/control` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-registrar open http://localhost:3200/platform/control && ./node_modules/.bin/agent-browser --session cca-registrar snapshot -i` |
| faculty | `/faculty` | required | loads | `./node_modules/.bin/agent-browser --session cca-faculty open http://localhost:3200/faculty && ./node_modules/.bin/agent-browser --session cca-faculty snapshot -i` |
| faculty | `/faculty/attendance` | required | loads | `./node_modules/.bin/agent-browser --session cca-faculty open http://localhost:3200/faculty/attendance && ./node_modules/.bin/agent-browser --session cca-faculty snapshot -i` |
| faculty | `/faculty/gradebook` | required | loads | `./node_modules/.bin/agent-browser --session cca-faculty open http://localhost:3200/faculty/gradebook && ./node_modules/.bin/agent-browser --session cca-faculty snapshot -i` |
| faculty | `/api/academy/attendance` | required | loads | `./node_modules/.bin/agent-browser --session cca-faculty open http://localhost:3200/api/academy/attendance && ./node_modules/.bin/agent-browser --session cca-faculty snapshot -i` |
| faculty | `/admin/billing` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-faculty open http://localhost:3200/admin/billing && ./node_modules/.bin/agent-browser --session cca-faculty snapshot -i` |
| faculty | `/admin/financial-aid` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-faculty open http://localhost:3200/admin/financial-aid && ./node_modules/.bin/agent-browser --session cca-faculty snapshot -i` |
| faculty | `/platform/control` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-faculty open http://localhost:3200/platform/control && ./node_modules/.bin/agent-browser --session cca-faculty snapshot -i` |
| student | `/student` | required | loads | `./node_modules/.bin/agent-browser --session cca-student open http://localhost:3200/student && ./node_modules/.bin/agent-browser --session cca-student snapshot -i` |
| student | `/student/courses` | required | loads | `./node_modules/.bin/agent-browser --session cca-student open http://localhost:3200/student/courses && ./node_modules/.bin/agent-browser --session cca-student snapshot -i` |
| student | `/student/schedule` | required | loads | `./node_modules/.bin/agent-browser --session cca-student open http://localhost:3200/student/schedule && ./node_modules/.bin/agent-browser --session cca-student snapshot -i` |
| student | `/student/account` | required | loads | `./node_modules/.bin/agent-browser --session cca-student open http://localhost:3200/student/account && ./node_modules/.bin/agent-browser --session cca-student snapshot -i` |
| student | `/student/documents` | required | loads | `./node_modules/.bin/agent-browser --session cca-student open http://localhost:3200/student/documents && ./node_modules/.bin/agent-browser --session cca-student snapshot -i` |
| student | `/admin` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-student open http://localhost:3200/admin && ./node_modules/.bin/agent-browser --session cca-student snapshot -i` |
| student | `/faculty` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-student open http://localhost:3200/faculty && ./node_modules/.bin/agent-browser --session cca-student snapshot -i` |
| student | `/platform/control` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-student open http://localhost:3200/platform/control && ./node_modules/.bin/agent-browser --session cca-student snapshot -i` |
| guardian | `/guardian` | required | loads | `./node_modules/.bin/agent-browser --session cca-guardian open http://localhost:3200/guardian && ./node_modules/.bin/agent-browser --session cca-guardian snapshot -i` |
| guardian | `/guardian/messages` | required | loads | `./node_modules/.bin/agent-browser --session cca-guardian open http://localhost:3200/guardian/messages && ./node_modules/.bin/agent-browser --session cca-guardian snapshot -i` |
| guardian | `/admin` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-guardian open http://localhost:3200/admin && ./node_modules/.bin/agent-browser --session cca-guardian snapshot -i` |
| guardian | `/faculty` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-guardian open http://localhost:3200/faculty && ./node_modules/.bin/agent-browser --session cca-guardian snapshot -i` |
| guardian | `/student` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-guardian open http://localhost:3200/student && ./node_modules/.bin/agent-browser --session cca-guardian snapshot -i` |
| guardian | `/platform/control` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-guardian open http://localhost:3200/platform/control && ./node_modules/.bin/agent-browser --session cca-guardian snapshot -i` |
| finance | `/admin/billing` | required | loads | `./node_modules/.bin/agent-browser --session cca-finance open http://localhost:3200/admin/billing && ./node_modules/.bin/agent-browser --session cca-finance snapshot -i` |
| finance | `/admin/financial-aid` | required | loads | `./node_modules/.bin/agent-browser --session cca-finance open http://localhost:3200/admin/financial-aid && ./node_modules/.bin/agent-browser --session cca-finance snapshot -i` |
| finance | `/api/academy/billing` | required | loads | `./node_modules/.bin/agent-browser --session cca-finance open http://localhost:3200/api/academy/billing && ./node_modules/.bin/agent-browser --session cca-finance snapshot -i` |
| finance | `/api/academy/financial-aid` | required | loads | `./node_modules/.bin/agent-browser --session cca-finance open http://localhost:3200/api/academy/financial-aid && ./node_modules/.bin/agent-browser --session cca-finance snapshot -i` |
| finance | `/faculty/gradebook` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-finance open http://localhost:3200/faculty/gradebook && ./node_modules/.bin/agent-browser --session cca-finance snapshot -i` |
| finance | `/platform/control` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-finance open http://localhost:3200/platform/control && ./node_modules/.bin/agent-browser --session cca-finance snapshot -i` |
| admissions | `/admin/admissions` | required | loads | `./node_modules/.bin/agent-browser --session cca-admissions open http://localhost:3200/admin/admissions && ./node_modules/.bin/agent-browser --session cca-admissions snapshot -i` |
| admissions | `/admin/admissions/decisions` | required | loads | `./node_modules/.bin/agent-browser --session cca-admissions open http://localhost:3200/admin/admissions/decisions && ./node_modules/.bin/agent-browser --session cca-admissions snapshot -i` |
| admissions | `/api/academy/admissions/applications` | required | loads | `./node_modules/.bin/agent-browser --session cca-admissions open http://localhost:3200/api/academy/admissions/applications && ./node_modules/.bin/agent-browser --session cca-admissions snapshot -i` |
| admissions | `/admin/billing` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-admissions open http://localhost:3200/admin/billing && ./node_modules/.bin/agent-browser --session cca-admissions snapshot -i` |
| admissions | `/faculty/gradebook` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-admissions open http://localhost:3200/faculty/gradebook && ./node_modules/.bin/agent-browser --session cca-admissions snapshot -i` |
| admissions | `/platform/control` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-admissions open http://localhost:3200/platform/control && ./node_modules/.bin/agent-browser --session cca-admissions snapshot -i` |
| platform_admin | `/platform/control` | required | loads | `./node_modules/.bin/agent-browser --session cca-platform_admin open http://localhost:3200/platform/control && ./node_modules/.bin/agent-browser --session cca-platform_admin snapshot -i` |
| platform_admin | `/api/platform/tenants` | required | loads | `./node_modules/.bin/agent-browser --session cca-platform_admin open http://localhost:3200/api/platform/tenants && ./node_modules/.bin/agent-browser --session cca-platform_admin snapshot -i` |
| platform_admin | `/api/platform/session` | required | loads | `./node_modules/.bin/agent-browser --session cca-platform_admin open http://localhost:3200/api/platform/session && ./node_modules/.bin/agent-browser --session cca-platform_admin snapshot -i` |
| platform_admin | `/admin/billing` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-platform_admin open http://localhost:3200/admin/billing && ./node_modules/.bin/agent-browser --session cca-platform_admin snapshot -i` |
| platform_admin | `/student` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-platform_admin open http://localhost:3200/student && ./node_modules/.bin/agent-browser --session cca-platform_admin snapshot -i` |
| platform_admin | `/faculty` | forbidden | denied | `./node_modules/.bin/agent-browser --session cca-platform_admin open http://localhost:3200/faculty && ./node_modules/.bin/agent-browser --session cca-platform_admin snapshot -i` |

## Result Recording

For each step, capture the agent-browser screenshot path, console errors, and observed status in the pilot tenant evidence log.
