-- Behavioral / conduct tracking and intervention records
-- Migration timestamp: 20260624160000

create table if not exists public.academy_conduct_records (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  student_person_id text not null references public.academy_people(id) on delete cascade,
  incident_date date not null,
  incident_type text not null check (incident_type in (
    'academic_dishonesty',
    'attendance_violation',
    'code_of_conduct',
    'harassment',
    'substance_policy',
    'property_damage',
    'disruptive_behavior',
    'other'
  )),
  severity text not null check (severity in ('minor','moderate','major','critical')),
  description text not null,
  reported_by_person_id text not null references public.academy_people(id),
  witnesses text[],
  status text not null default 'open' check (status in ('open','under_review','resolved','appealed','dismissed')),
  resolution text,
  resolved_at timestamptz,
  resolved_by_person_id text references public.academy_people(id),
  confidential boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_interventions (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  conduct_record_id text references public.academy_conduct_records(id) on delete set null,
  student_person_id text not null references public.academy_people(id) on delete cascade,
  intervention_type text not null check (intervention_type in (
    'counseling_referral',
    'academic_warning',
    'probation',
    'suspension',
    'community_service',
    'parent_notification',
    'mandatory_meeting',
    'other'
  )),
  assigned_to_person_id text not null references public.academy_people(id),
  due_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','missed','waived')),
  outcome_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_conduct_appeals (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  conduct_record_id text not null references public.academy_conduct_records(id) on delete cascade,
  appealed_by_person_id text not null,
  appeal_date date not null default current_date,
  grounds text not null,
  status text not null default 'pending' check (status in ('pending','upheld','overturned','dismissed')),
  reviewed_by_person_id text references public.academy_people(id),
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable row level security
alter table public.academy_conduct_records enable row level security;
alter table public.academy_conduct_records force row level security;
alter table public.academy_interventions enable row level security;
alter table public.academy_interventions force row level security;
alter table public.academy_conduct_appeals enable row level security;
alter table public.academy_conduct_appeals force row level security;

-- Row level security policies using app.academy_tenant_id
create policy "Tenant isolation for conduct records"
  on public.academy_conduct_records
  using (tenant_id = current_setting('app.academy_tenant_id', true));

create policy "Tenant isolation for interventions"
  on public.academy_interventions
  using (tenant_id = current_setting('app.academy_tenant_id', true));

create policy "Tenant isolation for conduct appeals"
  on public.academy_conduct_appeals
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Indexes for performance
create index idx_conduct_records_tenant_student
  on public.academy_conduct_records(tenant_id, student_person_id);

create index idx_conduct_records_status
  on public.academy_conduct_records(tenant_id, status);

create index idx_interventions_tenant_student
  on public.academy_interventions(tenant_id, student_person_id);

create index idx_interventions_assigned_to
  on public.academy_interventions(tenant_id, assigned_to_person_id);

create index idx_interventions_status
  on public.academy_interventions(tenant_id, status);

create index idx_conduct_appeals_record
  on public.academy_conduct_appeals(tenant_id, conduct_record_id);
