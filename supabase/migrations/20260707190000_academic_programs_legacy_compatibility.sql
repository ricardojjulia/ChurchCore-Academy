-- Bridge normalized academic programs into the legacy academy_programs table.
-- The legacy table remains because admissions, enrollment conversion, financial
-- aid, and reporting still hold text-keyed foreign keys into it.

alter table public.academy_programs
  add column if not exists program_code text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists status text not null default 'active',
  add column if not exists active boolean not null default true,
  add column if not exists program_type text,
  add column if not exists credit_hours numeric(6,2),
  add column if not exists clock_hours numeric(7,2),
  add column if not exists academic_program_id uuid;

update public.academy_programs
   set program_code = coalesce(program_code, upper(id)),
       title = coalesce(title, name),
       status = coalesce(nullif(status, ''), case when active then 'active' else 'archived' end),
       active = coalesce(active, status = 'active'),
       program_type = coalesce(program_type, credential),
       credit_hours = coalesce(credit_hours, required_credits::numeric),
       clock_hours = coalesce(clock_hours, 0)
 where title is null
    or program_code is null
    or program_type is null
    or credit_hours is null
    or clock_hours is null;

insert into public.academy_programs (
  id, tenant_id, name, credential, required_credits, cohort_label,
  program_code, title, description, status, active, program_type,
  credit_hours, clock_hours, academic_program_id
)
select p.id::text,
       p.tenant_id,
       p.title,
       p.credential_type,
       round(p.required_credits)::integer,
       p.institution_mode,
       p.program_code,
       p.title,
       p.description,
       p.status,
       p.status = 'active',
       p.credential_type,
       p.required_credits,
       p.required_clock_hours,
       p.id
  from public.academy_academic_programs p
on conflict (id) do update set
  tenant_id = excluded.tenant_id,
  name = excluded.name,
  credential = excluded.credential,
  required_credits = excluded.required_credits,
  cohort_label = excluded.cohort_label,
  program_code = excluded.program_code,
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  active = excluded.active,
  program_type = excluded.program_type,
  credit_hours = excluded.credit_hours,
  clock_hours = excluded.clock_hours,
  academic_program_id = excluded.academic_program_id;

create index if not exists academy_programs_tenant_status_idx
  on public.academy_programs (tenant_id, status, active);

create index if not exists academy_programs_academic_program_idx
  on public.academy_programs (tenant_id, academic_program_id)
  where academic_program_id is not null;
