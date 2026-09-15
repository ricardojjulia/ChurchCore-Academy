-- ADR-0053: Attendance threshold enforcement and guardian absence notifications
-- Sprint A-5 (T2-10)

-- Add session_type to attendance records
alter table public.academy_attendance_records
  add column if not exists session_type text not null default 'class'
    check (session_type in ('class', 'lab', 'chapel', 'spiritual_formation', 'other'));

comment on column public.academy_attendance_records.session_type is
  'Type of session: class (default), lab, chapel, spiritual_formation, or other. Spiritual formation sessions trigger guardian notifications on first miss.';

-- Add minimum_attendance_percentage to course sections
alter table public.academy_course_sections
  add column if not exists minimum_attendance_percentage integer not null default 80
    check (minimum_attendance_percentage >= 0 and minimum_attendance_percentage <= 100);

comment on column public.academy_course_sections.minimum_attendance_percentage is
  'Minimum attendance percentage required for this section (0-100). Default 80%. Set to 0 to disable threshold alerts for this section.';

-- Create index for session type queries (spiritual formation notifications)
create index if not exists academy_attendance_session_type_idx
  on public.academy_attendance_records (tenant_id, course_section_id, student_person_id, session_type, session_date);

-- Create consecutive absence tracking table
create table if not exists public.academy_attendance_consecutive_tracking (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             text not null,
  course_section_id     uuid not null,
  student_person_id     uuid not null,
  consecutive_absences  integer not null default 0,
  last_absence_date     date,
  last_notification_sent_at timestamptz,
  updated_at            timestamptz not null default now(),

  unique (tenant_id, course_section_id, student_person_id)
);

comment on table public.academy_attendance_consecutive_tracking is
  'Tracks consecutive absences per student per section for guardian notification deduplication (3+ consecutive triggers notification)';

-- Tenant isolation
alter table public.academy_attendance_consecutive_tracking enable row level security;
alter table public.academy_attendance_consecutive_tracking force row level security;

create policy academy_attendance_consecutive_tenant_isolation
  on public.academy_attendance_consecutive_tracking
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Index for threshold checks
create index if not exists academy_attendance_consecutive_section_idx
  on public.academy_attendance_consecutive_tracking (tenant_id, course_section_id);

create index if not exists academy_attendance_consecutive_student_idx
  on public.academy_attendance_consecutive_tracking (tenant_id, student_person_id);
