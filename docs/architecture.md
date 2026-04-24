# ChurchCore Academy Architecture Boundary

## Repositories

### ChurchCore Academy repository

Owns:

- SIS and college-management workflows
- students, faculty, administrators, academic records, and permissions
- admissions, enrollment, transcript, graduation, and compliance operations
- dashboards, reporting, and academic-administrative workflows
- LMS launch orchestration from the Academy side

Does not own:

- Moodle runtime
- Moodle themes or plugins
- LMS course delivery behavior

### ChurchCore Learning repository

Owns:

- Moodle fork maintenance
- Moodle themes and plugins
- LMS user experience
- course delivery and learning runtime concerns
- Academy-driven launch and sync endpoints exposed inside Moodle

## Integration contract

Keep the cross-system boundary narrow and explicit:

- identity handoff
- tenant and campus context
- enrollment sync
- roster sync
- grade/progress return path
- logout coordination
- audit logging across systems

## Architectural rule

If a feature still makes sense when Moodle is removed, it belongs in the ChurchCore Academy repository.

If a feature only exists because Moodle behaves a certain way, it belongs in the ChurchCore Learning repository.
