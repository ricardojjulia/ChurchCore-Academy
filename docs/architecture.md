# ChurchCore Academy Architecture Boundary

## Repositories

### ChurchCore Academy repository

Owns:

- faith-based SIS and education-management workflows
- Bible school, children's school, seminary, college, and university configuration
- students, guardians, faculty, teachers, professors, administrators, academic records, and permissions
- academic years, terms, sessions, cohorts, campuses, departments, divisions, calendars, course catalogs, sections, grading models, transcripts, and student PWA workflows
- admissions, enrollment, transcript, grading, graduation, and compliance operations
- dashboards, reporting, and academic-administrative workflows
- LMS launch orchestration from the Academy side

Does not own:

- Moodle runtime
- Moodle themes or plugins
- Canvas runtime internals
- LMS course delivery behavior

### LMS provider repositories or services

Owns:

- Moodle or Canvas runtime maintenance
- LMS themes, plugins, extensions, or provider-specific deployment assets
- LMS course delivery experience
- course delivery and learning runtime concerns
- Academy-driven launch and sync endpoints exposed inside the provider

## Integration contract

Keep the cross-system boundary narrow and explicit:

- identity handoff
- tenant and campus context
- enrollment sync
- roster sync
- grade/progress return path
- logout coordination
- audit logging across systems
- provider capability reporting
- reconciliation jobs and idempotent retries

## Architectural rule

If a feature still makes sense when Moodle is removed, it belongs in the ChurchCore Academy repository.

If a feature only exists because Moodle or Canvas behaves a certain way, it belongs in an LMS provider adapter or provider repository, not in Academy domain logic.
