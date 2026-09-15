create table if not exists public.ministry_practicum_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id),
  student_person_id text not null,
  recorded_by_person_id text not null,
  hours numeric(5,2) not null check (hours > 0),
  site_name text not null,
  supervisor_name text not null,
  session_date date not null,
  reflection_note text,
  status text not null default 'draft' check (status in ('draft', 'endorsed')),
  endorsed_by_person_id text,
  endorsed_at timestamptz,
  is_transfer_credit boolean not null default false,
  source_institution text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, student_person_id) references public.academy_people (tenant_id, id),
  foreign key (tenant_id, recorded_by_person_id) references public.academy_people (tenant_id, id)
);

create table if not exists public.ministry_faith_milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id),
  student_person_id text not null,
  recorded_by_person_id text not null,
  milestone_type text not null check (milestone_type in (
    'baptism', 'ordination', 'ministry_practicum_completion',
    'spiritual_formation_review', 'pastoral_endorsement', 'custom'
  )),
  custom_type_label text,
  milestone_date date not null,
  witness_names text[],
  institution_notes text,
  status text not null default 'draft' check (status in ('draft', 'endorsed')),
  endorsed_by_person_id text,
  endorsed_at timestamptz,
  is_transfer_credit boolean not null default false,
  source_institution text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, student_person_id) references public.academy_people (tenant_id, id)
);

create table if not exists public.ministry_formation_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id),
  student_person_id text not null,
  evaluator_person_id text not null,
  evaluator_name_snapshot text not null,
  rubric_label text not null,
  scores jsonb not null default '{}',
  pastoral_notes text,
  status text not null default 'draft' check (status in ('draft', 'endorsed')),
  endorsed_by_person_id text,
  endorsed_at timestamptz,
  evaluation_date date not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, student_person_id) references public.academy_people (tenant_id, id),
  foreign key (tenant_id, evaluator_person_id) references public.academy_people (tenant_id, id)
);

-- RLS on all three tables
alter table public.ministry_practicum_sessions enable row level security;
alter table public.ministry_practicum_sessions force row level security;
create policy "tenant_isolation_mps" on public.ministry_practicum_sessions
  using (tenant_id = current_setting('app.academy_tenant_id', true));

alter table public.ministry_faith_milestones enable row level security;
alter table public.ministry_faith_milestones force row level security;
create policy "tenant_isolation_mfm" on public.ministry_faith_milestones
  using (tenant_id = current_setting('app.academy_tenant_id', true));

alter table public.ministry_formation_evaluations enable row level security;
alter table public.ministry_formation_evaluations force row level security;
create policy "tenant_isolation_mfe" on public.ministry_formation_evaluations
  using (tenant_id = current_setting('app.academy_tenant_id', true));
