-- ADR-0049: Student Record Editable Fields and Advisor Notes Audit Model
-- Advisor notes table with note_type and visible_to_student fields

create table if not exists public.academy_advisor_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  student_person_id text not null references public.academy_people(id) on delete restrict,
  author_person_id text not null references public.academy_people(id) on delete restrict,
  note_text text not null check (length(note_text) > 0 and length(note_text) <= 4000),
  note_type text not null check (note_type in ('academic', 'pastoral', 'financial', 'disciplinary', 'general')),
  visible_to_student boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index for student note lookups
create index if not exists academy_advisor_notes_student_idx
  on public.academy_advisor_notes (tenant_id, student_person_id, created_at desc);

-- Index for author lookups
create index if not exists academy_advisor_notes_author_idx
  on public.academy_advisor_notes (tenant_id, author_person_id, created_at desc);

-- Immutable: prevent updates/deletes (append-only)
create or replace function academy_private.prevent_advisor_note_modification()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Advisor notes are append-only and cannot be modified or deleted.';
end;
$$;

drop trigger if exists academy_advisor_notes_immutable_update
  on public.academy_advisor_notes;

create trigger academy_advisor_notes_immutable_update
before update on public.academy_advisor_notes
for each row execute function academy_private.prevent_advisor_note_modification();

drop trigger if exists academy_advisor_notes_immutable_delete
  on public.academy_advisor_notes;

create trigger academy_advisor_notes_immutable_delete
before delete on public.academy_advisor_notes
for each row execute function academy_private.prevent_advisor_note_modification();

-- Row-level security
alter table public.academy_advisor_notes enable row level security;
alter table public.academy_advisor_notes force row level security;

-- Staff with advisor/registrar/admin roles can read all notes
drop policy if exists academy_advisor_notes_staff_read on public.academy_advisor_notes;
create policy academy_advisor_notes_staff_read
on public.academy_advisor_notes
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'advisor', 'dean', 'academic_admin', 'faculty']
  )
);

-- Students can only read notes where visible_to_student = true
drop policy if exists academy_advisor_notes_student_read on public.academy_advisor_notes;
create policy academy_advisor_notes_student_read
on public.academy_advisor_notes
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and student_person_id = academy_private.academy_current_person_id()
  and visible_to_student = true
);

-- Staff with advisor/registrar/admin roles can insert notes
drop policy if exists academy_advisor_notes_staff_insert on public.academy_advisor_notes;
create policy academy_advisor_notes_staff_insert
on public.academy_advisor_notes
for insert
with check (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'advisor', 'dean', 'academic_admin']
  )
);
