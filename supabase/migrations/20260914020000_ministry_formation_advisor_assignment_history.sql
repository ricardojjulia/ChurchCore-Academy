create table if not exists public.ministry_formation_advisor_assignment_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id),
  student_person_id text not null,
  advisor_person_id text not null,
  assigned_at timestamptz not null,
  assigned_by_person_id text not null,
  recorded_at timestamptz not null default now(),
  foreign key (tenant_id, student_person_id) references public.academy_people (tenant_id, id),
  foreign key (tenant_id, advisor_person_id) references public.academy_people (tenant_id, id),
  foreign key (tenant_id, assigned_by_person_id) references public.academy_people (tenant_id, id)
);

-- RLS
alter table public.ministry_formation_advisor_assignment_history enable row level security;
alter table public.ministry_formation_advisor_assignment_history force row level security;
create policy "tenant_isolation_mfaah" on public.ministry_formation_advisor_assignment_history
  using (tenant_id = current_setting('app.academy_tenant_id', true));
