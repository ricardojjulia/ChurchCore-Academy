-- Add lifecycle state documentation and constraints for academic calendar entities
-- ADR-0050: Academic Calendar Admin CRUD with Term-Lock Policy

-- Document valid lifecycle states for academic years and periods
-- Valid states: planned, enrollment_open, active, completed, archived
-- Note: The status column already exists as text; this migration adds documentation

comment on column academy_academic_years.status is
  'Lifecycle state: draft, active, or archived. For new workflow: planned | enrollment_open | active | completed | archived';

comment on column academy_academic_periods.status is
  'Lifecycle state: planned | enrollment_open | active | completed | archived. Controls field edit permissions and state transitions.';

-- Add index to support efficient status-based queries
create index if not exists academy_academic_periods_status_idx
  on academy_academic_periods (tenant_id, status, starts_on);

-- Add comment documenting section-assignment lock behavior
comment on table academy_course_sections is
  'Course sections. When sections reference a period_id, that period dates are locked from editing per ADR-0050.';
