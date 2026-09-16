-- Academic standing evaluation persistence for T2-16
create table if not exists public.academy_standing_evaluations (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  student_person_id text not null,
  academic_year_id text,
  period_id text,
  evaluated_at timestamptz not null default now(),
  evaluated_by_person_id text not null,
  computed_standing_types jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  summary jsonb not null,
  promotion_ready boolean not null default false,
  graduation_ready boolean not null default false,
  graduation_blocked boolean not null default false,
  constraint fk_standing_eval_student
    foreign key (tenant_id, student_person_id) references public.academy_people (tenant_id, id),
  constraint fk_standing_eval_evaluator
    foreign key (tenant_id, evaluated_by_person_id) references public.academy_people (tenant_id, id),
  constraint fk_standing_eval_year
    foreign key (tenant_id, academic_year_id) references public.academy_academic_years (tenant_id, id),
  constraint fk_standing_eval_period
    foreign key (tenant_id, period_id) references public.academy_academic_periods (tenant_id, id)
);

create index if not exists academy_standing_evaluations_tenant_student_idx
  on public.academy_standing_evaluations (tenant_id, student_person_id, evaluated_at desc);

alter table public.academy_standing_evaluations enable row level security;
alter table public.academy_standing_evaluations force row level security;

create policy "tenant_isolation_standing_evaluations" on public.academy_standing_evaluations
  using (tenant_id = current_setting('app.academy_tenant_id', true));
