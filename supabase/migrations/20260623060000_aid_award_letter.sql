alter table public.academy_aid_packages
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists decision_by_person_id text,
  add column if not exists acceptance_deadline timestamptz,
  add column if not exists award_letter_storage_path text,
  add column if not exists letter_status text default 'not_generated'
    check (letter_status in ('not_generated', 'generated', 'sent'));

create table if not exists public.academy_aid_letters (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  student_person_id text not null,
  aid_package_id uuid not null,
  term_id text,
  status text not null default 'draft' check (status in ('draft', 'issued', 'accepted', 'declined', 'expired')),
  issued_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz not null,
  decision_by_person_id text,
  acceptance_ip_hash text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, aid_package_id)
    references public.academy_aid_packages (tenant_id, id) on delete restrict,
  foreign key (tenant_id, decision_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  check (acceptance_ip_hash is null or acceptance_ip_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists academy_aid_letters_package_idx
  on public.academy_aid_letters (tenant_id, aid_package_id, issued_at desc);

create index if not exists academy_aid_letters_student_idx
  on public.academy_aid_letters (tenant_id, student_person_id, expires_at desc);

drop trigger if exists academy_aid_letters_touch_updated_at on public.academy_aid_letters;
create trigger academy_aid_letters_touch_updated_at
before update on public.academy_aid_letters
for each row execute function public.academy_touch_financial_aid_updated_at();

alter table public.academy_aid_letters enable row level security;
alter table public.academy_aid_letters force row level security;

revoke all on public.academy_aid_letters from anon;
grant select, insert, update on public.academy_aid_letters to authenticated;

drop policy if exists academy_aid_letters_read on public.academy_aid_letters;
create policy academy_aid_letters_read
on public.academy_aid_letters
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'finance', 'registrar', 'academic_admin']
    )
  )
);

drop policy if exists academy_aid_letters_admin_write on public.academy_aid_letters;
create policy academy_aid_letters_admin_write
on public.academy_aid_letters
for insert
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'finance']
  )
);

drop policy if exists academy_aid_letters_update on public.academy_aid_letters;
create policy academy_aid_letters_update
on public.academy_aid_letters
for update
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'finance']
  )
  or (
    student_person_id = academy_private.academy_current_person_id()
    and status = 'issued'
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'finance']
  )
  or student_person_id = academy_private.academy_current_person_id()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-aid-letters',
  'academy-aid-letters',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- add award_letter_ready template to communications constraint
alter table public.academy_communication_messages
  drop constraint if exists academy_communication_messages_template_key_check;

alter table public.academy_communication_messages
  add constraint academy_communication_messages_template_key_check
  check (template_key in (
    'admissions_decision',
    'registration_confirmation',
    'transcript_update',
    'billing_account_update',
    'grade_release',
    'attendance_concern',
    'workflow_assignment',
    'application_received',
    'award_letter_ready',
    'award_letter_updated'
  ));
