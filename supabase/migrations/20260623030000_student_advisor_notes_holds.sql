-- Student advisor notes for T2-11
create table if not exists public.academy_student_advisor_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id),
  student_person_id text not null,
  author_person_id text not null,
  note_text text not null,
  created_at timestamptz not null default now(),
  constraint fk_asn_student
    foreign key (tenant_id, student_person_id) references public.academy_people (tenant_id, id),
  constraint fk_asn_author
    foreign key (tenant_id, author_person_id) references public.academy_people (tenant_id, id)
);

alter table public.academy_student_advisor_notes enable row level security;
alter table public.academy_student_advisor_notes force row level security;

create policy "tenant_isolation_asn" on public.academy_student_advisor_notes
  using (tenant_id = current_setting('app.academy_tenant_id', true));

create index if not exists academy_student_advisor_notes_tenant_student_idx
  on public.academy_student_advisor_notes (tenant_id, student_person_id, created_at desc);

-- Student holds for T2-11
create table if not exists public.academy_student_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id),
  student_person_id text not null,
  hold_type text not null check (hold_type in ('financial', 'academic', 'administrative', 'disciplinary')),
  note text not null,
  added_by_person_id text not null,
  added_at timestamptz not null default now(),
  cleared_by_person_id text,
  cleared_at timestamptz,
  resolution_note text,
  constraint fk_hold_student
    foreign key (tenant_id, student_person_id) references public.academy_people (tenant_id, id),
  constraint fk_hold_added_by
    foreign key (tenant_id, added_by_person_id) references public.academy_people (tenant_id, id)
);

alter table public.academy_student_holds enable row level security;
alter table public.academy_student_holds force row level security;

create policy "tenant_isolation_ash" on public.academy_student_holds
  using (tenant_id = current_setting('app.academy_tenant_id', true));

create index if not exists academy_student_holds_tenant_student_idx
  on public.academy_student_holds (tenant_id, student_person_id, cleared_at);

-- Add enrollment status override to student profiles
alter table public.academy_student_profiles
  add column if not exists enrollment_status_override text
    check (enrollment_status_override in ('active', 'leave_of_absence', 'withdrawn', 'graduated', 'suspended', 'dismissed'));
