ChurchCore Academy — Council Evaluation Report
SIS Readiness Assessment · 2026-06-17 · v0.7.1

Executive Summary
The system has a solid architectural foundation — auth, RLS, migrations, and the core domain modules are production-quality. The gap is entirely in the presentation layer: 26 of 43 navigable routes produce 404 errors, the faculty portal is almost entirely missing, and two SIS functional areas (Communications, Reporting) have zero implementation. Three nav shell bugs make the app feel broken before a user clicks anything.

Overall SIS readiness: 38% — functional enough to demo admissions, student records, and grading foundations, but not enough to run a real academic term.

Council Finding 1 — Route Inventory
Surface	Routes in Nav	Pages Exist	404s
Admin core	18	14	4
Admin finance	3	0	3
Faculty portal	14	2	12
Student PWA	~8	~6	0 (but 2 are static/fake)
Total	43	17	26 (60%)
Dead routes (nav links that 404):

/admin/admissions/decisions, /admin/admissions/matriculation
/admin/gradebook
/admin/finance/tuition, /admin/finance/billing, /admin/finance/aid
/admin/settings/integrations
/faculty/schedule, /faculty/sections, /faculty/roster, /faculty/gradebook, /faculty/gradebook/history, /faculty/students, /faculty/notes, /faculty/shepherd, /faculty/shepherd/recommendations, /faculty/messages, /faculty/syllabi, /faculty/assignments
Council Finding 2 — Navigation Shell Bugs
Bug	Severity	Root cause
Logout button invisible when sidebar is collapsed	HIGH	.admin-signout { opacity: 0 } — only visible when .is-open
No tooltips on individual nav items	MEDIUM	title exists on section triggers only, not on <a> items inside
No expand affordance on collapsed sidebar	LOW	No hamburger/chevron visible when collapsed
User info hidden when collapsed	LOW	Same opacity: 0 pattern as logout
Sign-out action only wired per page, not in shell	MEDIUM	Each dashboard passes signOutAction as a prop; pages that don't pass it lose logout
Council Finding 3 — SIS Feature Completeness
Area	Status	Critical gap
Admissions	PARTIAL	No decisions queue UI, no matriculation screen
Student Records	PARTIAL	Read-only; no contact/profile edit; no history timeline
Academic Programs	PARTIAL	No course-to-program requirements map
Course Catalog	PARTIAL	Read-only; no create/edit UI
Enrollment / Registration	PARTIAL	POST-only; no drop/withdraw endpoint or UI
Attendance	STUB	API and form exist; no admin aggregate view, no student history
Grading	PARTIAL	Gradebook page missing from admin nav (404)
Transcripts	STUB	Issuance records only; no document content; no issue/revoke UI
Graduation	PARTIAL	Threshold check only; no degree audit checklist per course
Faculty Management	STUB	No faculty profile CRUD, no load calculation, portal mostly 404
Guardian Portal	STUB	Data model exists; zero UI
Communications	MISSING	No module, no tables, no routes, no UI
Calendar / Scheduling	PARTIAL	No student-facing live calendar
Reporting / Analytics	MISSING	No module, no tables, no routes, no UI
User / Role Management	STUB	DB-seed only; no invite/assign/revoke UI
Student PWA	PARTIAL	Schedule and messages show static/seeded content
Implementation Prompt Deck
Ordered by impact-to-effort ratio. Each prompt is self-contained and can be handed directly to the build agents.

Prompt A — Nav Shell: Fix Logout, Tooltips, and Dead Finance Links
Priority: P0 — Do this first. Every user hits these bugs.

Scope:

Make the logout button always visible in admin-shell.tsx and faculty-shell.tsx. When collapsed, show it as an icon-only button with title="Sign out". Remove the opacity: 0 hiding from src/styles/admin.css.
Add title={item.label} to every <Link> in the nav item list (the .admin-nav-item anchors) in both shells so collapsed icons have browser tooltips.
Remove the entire Finance section from admin-shell.tsx nav config (tuition, billing, aid). Finance is out-of-scope per CLAUDE.md and these 3 routes produce 404s. The section can be re-added when the module is built.
Remove settings/integrations from the System nav section — same reason, same fix.
Remove the 12 unbuilt faculty routes from faculty-shell.tsx nav config: schedule, sections, roster, gradebook, gradebook/history, students, notes, shepherd, shepherd/recommendations, messages, syllabi, assignments. Replace the entire faculty nav with only: Today → Attendance and My Sections → Sections & Roster (pointing at pages that will be built in Prompt C). This eliminates all faculty 404s immediately.
Files: src/components/admin-shell.tsx, src/components/faculty-shell.tsx, src/styles/admin.css
Tests: Lint + build pass. No nav item produces a 404. Logout button is visible in collapsed and expanded sidebar.
Done when: A user can sign out from any page without expanding the sidebar. No nav link 404s.

Prompt B — Admin: Gradebook Page + Admissions Decision/Matriculation Screens
Priority: P1 — Core admin daily ops. All three are in the nav and 404.

Scope:

B1 — /admin/gradebook
Build a server component that loads dataset.sections and dataset.students from loadProtectedAcademyDataset(). Show a table of all course sections with: section code, course name, period, instructor, enrolled count, graded submissions count (query academy_gradebook_records grouped by section), and a link to the faculty gradebook entry for that section. Metric cards: total sections, sections with pending grades, sections fully graded.

B2 — /admin/admissions/decisions
Build a server component using PostgresAdmissionsRepository that fetches applications filtered to status IN ('submitted', 'under_review'). Show a table with: applicant name, program, submitted date, status badge, and action links to the existing /admin/admissions detail. Metric cards: submitted count, under review count, average review time.

B3 — /admin/admissions/matriculation
Build a server component that fetches applications with status = 'accepted' and joins academy_program_enrollments to identify which accepted applicants have NOT yet been enrolled. Show two tables: "Pending Matriculation" (accepted, not yet enrolled) and "Matriculated" (accepted + enrolled). Each row links to the student profile. Metric card: awaiting matriculation count.

Files: src/app/admin/gradebook/page.tsx (NEW), src/app/admin/admissions/decisions/page.tsx (NEW), src/app/admin/admissions/matriculation/page.tsx (NEW)
Tests: Pages load with real data, no mock imports, cross-tenant rejection tested.
Done when: All three nav items load real data. 404s eliminated.

Prompt C — Faculty Portal Core: Sections, Roster, Schedule, Gradebook
Priority: P1 — Faculty have almost no working portal. This builds the essential four.

Scope:

C1 — /faculty/schedule
Server component. Resolve faculty actor via loadProtectedAcademyDataset(). Filter dataset.sections to sections where primaryInstructorId matches the actor's userId. Display a weekly or period-grouped view of assigned sections with: section code, course name, period, delivery method, enrolled count, meeting schedule (if present). If no sections assigned, show empty state with link to admin.

C2 — /faculty/sections
Server component. Same data as schedule but in table format. Each row has: section code, course, period, enrolled/capacity, status. Each row links to the roster for that section.

C3 — /faculty/roster (with ?sectionId= param)
Server component. Accept searchParams.sectionId. Load registrations for that section from academy_course_section_registrations joined to academy_people + academy_student_profiles. Show a table of enrolled students: name, email, enrollment status, credits, GPA, link to student profile. If no sectionId, show a section picker.

C4 — /faculty/gradebook
Server component + client grade entry form. Load the faculty's sections. For each section, show enrolled students and their current grade records from academy_gradebook_records. Allow selecting a student and entering/updating a grade via the existing gradebook API or a new PATCH /api/academy/gradebook/records/[id] endpoint. Reuse the existing grade entry patterns from the admin gradebook module.

Files: src/app/faculty/schedule/page.tsx, src/app/faculty/sections/page.tsx, src/app/faculty/roster/page.tsx, src/app/faculty/gradebook/page.tsx (all NEW). Update faculty-shell.tsx nav after Prompt A to add these four links back.
Tests: Pages load with faculty actor scoped to their sections only. Cross-tenant rejection tested. Faculty cannot see sections they are not assigned to.
Done when: A faculty member can see their schedule, click into a section's roster, and enter grades.

Prompt D — Student PWA: Live Schedule and Honest Empty States
Priority: P2 — Students currently see fake/seeded data in schedule and messages.

Scope:

D1 — /student/schedule (live data)
Replace the current static content with a server component that calls loadStudentPwaPageModel() (or the direct pool pattern) to fetch the authenticated student's academy_course_section_registrations for the current active period. Join to academy_course_sections and academy_courses. Display: course name, section code, period, delivery method, instructor name, meeting schedule. If no registrations, show a clear empty state ("You are not enrolled in any sections this period") with a link to contact the registrar.

D2 — /student/messages (honest empty state)
Remove the two hardcoded static welcome messages. Show an honest empty state: "Messaging is not yet available. Contact your advisor or registrar directly." with contact info from the institution profile. Do not fake a working inbox.

D3 — /student/progress (live credit data)
If the progress page is static, wire it to the student's creditsEarned, gpa, programId, and the matching program's requiredCredits from the student PWA page model. Show a progress bar and credit summary.

Files: src/app/student/schedule/page.tsx, src/app/student/messages/page.tsx, src/app/student/progress/page.tsx
Tests: Schedule page shows real registrations for the seeded student persona. Empty states render correctly for students with no registrations.
Done when: No student-facing page shows hardcoded content. Every empty state is honest about what is and is not available.

Prompt E — User & Role Management: Staff Invite and Role Assignment UI
Priority: P2 — Role assignment requires direct DB access today. Onboarding is impossible without this.

Scope:

E1 — /admin/settings/people improvements
The existing page is read-only. Add:

An "Invite Staff" form (name, email, role) that calls a new POST /api/academy/staff/invite route. The route: creates an academy_people record, creates an academy_staff_profiles record, creates an academy_person_role_assignments record with the chosen role, and calls supabase.auth.admin.inviteUserByEmail() via the service role client to send the Supabase invite email.
A "Deactivate" button on each staff card that calls PATCH /api/academy/staff/[id]/status to set their role assignment to inactive.
A role dropdown on each staff card to change their current role via PATCH /api/academy/staff/[id]/role.
E2 — /admin/settings/people student section
Add an "Edit" link on each student card that opens the existing student profile at /admin/students/[id].

Files: src/app/admin/settings/people/page.tsx (UPDATE), src/app/api/academy/staff/invite/route.ts (NEW), src/app/api/academy/staff/[id]/status/route.ts (NEW), src/app/api/academy/staff/[id]/role/route.ts (NEW)
Tests: Invite flow creates people + role + platform records. Deactivate sets status inactive. Cross-tenant isolation on all three new routes.
Done when: An admin can invite a new faculty member via the UI without touching the database directly.

Prompt F — Enrollment: Drop/Withdraw + Registration Status UI
Priority: P2 — No academic term can operate without a withdraw mechanism.

Scope:

F1 — DELETE /api/academy/registrations (or PATCH to status withdrawn)
Add a DELETE handler (or PATCH with { status: 'withdrawn' }) to the existing registrations route. Validate: actor is institution_admin, registrar, or academic_admin. Update academy_course_section_registrations.status to 'withdrawn' and decrement the live roster count. Return the updated record.

F2 — /admin/sections roster action
On the existing sections page, add a "Withdraw" button next to each enrolled student in the roster view. Wire it to the new DELETE/PATCH endpoint. Show a confirmation dialog before acting.

F3 — Registration status badges
On /admin/students/[id], show each course registration with its current status (enrolled, withdrawn, completed) with color-coded badges. Currently only enrolled registrations appear.

Files: src/app/api/academy/registrations/route.ts (UPDATE — add DELETE/PATCH), src/app/admin/sections/page.tsx (UPDATE), src/app/admin/students/[id]/page.tsx (UPDATE)
Tests: Withdraw endpoint sets status, enforces tenant, rejects non-admin roles. Withdrawn student no longer counted in roster. Cross-tenant rejection.
Done when: An admin can withdraw a student from a section via the UI. Registration status is visible on student profiles.

Recommended Execution Order

A (Nav shell)  →  B (Admin 404s)  →  C (Faculty portal)
     ↓
D (Student PWA live data)  →  E (Staff invite)  →  F (Drop/withdraw)
Run npm test && npm run lint && npm run build between each prompt. Each prompt is independent of the next within a wave — A must complete before B, C, D (since A removes dead nav items that would confuse testing of the others).

Council report complete. Prompts A–F cover the highest-impact gaps. Finance, Communications, Guardian Portal, and Reporting are deliberately deferred — they require new modules and are out of scope for this phase.