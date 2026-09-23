-- Graduation Clearance Workflow
-- Council-approved 2026-09-22, Phase 14 sprint 5
-- Adds a per-student graduation clearance record that lets a registrar / dean formally
-- initiate and record a clearance decision (cleared vs. deferred) with an audit trail.

create type academy_graduation_clearance_status as enum ('pending', 'cleared', 'deferred');

create table academy_graduation_clearances (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references academy_tenants(id) on delete cascade,
  student_profile_id      uuid not null references academy_student_profiles(id) on delete cascade,
  academic_program_id     uuid not null references academy_academic_programs(id),
  academic_year_id        uuid not null references academy_academic_years(id),
  status                  academy_graduation_clearance_status not null default 'pending',
  initiated_by_person_id  uuid not null references academy_people(id),
  initiated_at            timestamptz not null default now(),
  cleared_by_person_id    uuid references academy_people(id),
  cleared_at              timestamptz,
  deferred_reason         text,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(tenant_id, student_profile_id, academic_program_id, academic_year_id)
);

alter table academy_graduation_clearances enable row level security;

-- Read: staff roles that can access the graduation audit page
create policy "Clearances readable by graduation-review roles"
  on academy_graduation_clearances for select
  using (
    tenant_id = (select tenant_id from academy_people where id = auth.uid())
    and exists (
      select 1 from academy_person_roles r
       where r.person_id = auth.uid()
         and r.role in ('institution_admin', 'dean', 'registrar', 'academic_admin')
         and (r.expires_at is null or r.expires_at > now())
    )
  );

-- Write: same roles, tenant-scoped with check
create policy "Clearances writable by graduation-review roles"
  on academy_graduation_clearances for all
  using (
    tenant_id = (select tenant_id from academy_people where id = auth.uid())
    and exists (
      select 1 from academy_person_roles r
       where r.person_id = auth.uid()
         and r.role in ('institution_admin', 'dean', 'registrar', 'academic_admin')
         and (r.expires_at is null or r.expires_at > now())
    )
  )
  with check (
    tenant_id = (select tenant_id from academy_people where id = auth.uid())
  );
