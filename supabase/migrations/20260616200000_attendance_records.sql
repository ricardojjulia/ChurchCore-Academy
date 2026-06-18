-- Attendance records: faculty-entered per-session per-student per-section
create table if not exists public.academy_attendance_records (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             text not null,
  course_section_id     uuid not null,
  student_person_id     uuid not null,
  session_date          date not null,
  status                text not null check (status in ('present', 'absent', 'late', 'excused')),
  recorded_at           timestamptz not null default now(),
  recorded_by_person_id uuid not null,
  note                  text,

  -- One record per student per section per session date; upsert replaces
  unique (tenant_id, course_section_id, student_person_id, session_date)
);

-- Tenant isolation enforced via RLS
alter table public.academy_attendance_records enable row level security;
alter table public.academy_attendance_records force row level security;

create policy academy_attendance_tenant_isolation
  on public.academy_attendance_records
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Lookups by section (faculty entry, roster view)
create index if not exists academy_attendance_section_date_idx
  on public.academy_attendance_records (tenant_id, course_section_id, session_date);

-- Lookups by student (student PWA attendance history)
create index if not exists academy_attendance_student_idx
  on public.academy_attendance_records (tenant_id, student_person_id, session_date desc);
