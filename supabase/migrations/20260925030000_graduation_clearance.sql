-- Graduation clearance workflow (council-approved 2026-09-22, Phase 14 sprint 5).
-- A registrar/dean initiates a clearance for a student's program + catalog year and records
-- the decision (cleared or deferred, with a reason) as an audit trail.
--
-- Follows the live schema's conventions: text tenant/person/profile/year ids, uuid academic
-- program ids, tenant-scoped composite foreign keys, and tenant isolation through the
-- app.academy_tenant_id setting (role checks live in the service, like every other module).

create table if not exists public.academy_graduation_clearances (
  id                     text primary key default gen_random_uuid()::text,
  tenant_id              text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  student_profile_id     text not null,
  academic_program_id    uuid not null,
  academic_year_id       text not null,
  status                 text not null default 'pending'
                           check (status in ('pending', 'cleared', 'deferred')),
  initiated_by_person_id text not null,
  initiated_at           timestamptz not null default now(),
  -- Who decided (cleared or deferred) and when.
  cleared_by_person_id   text,
  cleared_at             timestamptz,
  deferred_reason        text,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint academy_graduation_clearances_student_fk
    foreign key (tenant_id, student_profile_id) references public.academy_student_profiles (tenant_id, id) on delete cascade,
  constraint academy_graduation_clearances_program_fk
    foreign key (tenant_id, academic_program_id) references public.academy_academic_programs (tenant_id, id),
  constraint academy_graduation_clearances_year_fk
    foreign key (tenant_id, academic_year_id) references public.academy_academic_years (tenant_id, id),
  constraint academy_graduation_clearances_initiator_fk
    foreign key (tenant_id, initiated_by_person_id) references public.academy_people (tenant_id, id),
  constraint academy_graduation_clearances_decider_fk
    foreign key (tenant_id, cleared_by_person_id) references public.academy_people (tenant_id, id),
  constraint academy_graduation_clearances_deferral_has_reason
    check (status <> 'deferred' or length(trim(coalesce(deferred_reason, ''))) > 0),
  constraint academy_graduation_clearances_decision_recorded
    check (status = 'pending' or (cleared_by_person_id is not null and cleared_at is not null))
);

-- One open (pending or cleared) clearance per student + program + catalog year; a deferred
-- clearance can be followed by a fresh one.
create unique index if not exists academy_graduation_clearances_one_open_idx
  on public.academy_graduation_clearances (tenant_id, student_profile_id, academic_program_id, academic_year_id)
  where status <> 'deferred';

create index if not exists academy_graduation_clearances_student_idx
  on public.academy_graduation_clearances (tenant_id, student_profile_id, initiated_at desc);

alter table public.academy_graduation_clearances enable row level security;
alter table public.academy_graduation_clearances force row level security;

create policy academy_graduation_clearances_tenant_isolation
  on public.academy_graduation_clearances
  using (tenant_id = current_setting('app.academy_tenant_id', true))
  with check (tenant_id = current_setting('app.academy_tenant_id', true));
