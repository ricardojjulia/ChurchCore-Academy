-- T2-02: Application Document Checklist
-- Document requirement templates per program and per-application snapshot tracking

create table if not exists public.academy_program_document_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id),
  program_id uuid not null,
  label text not null,
  description text,
  is_required boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_application_document_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id),
  application_id uuid not null,
  requirement_id uuid not null,
  label text not null,
  is_required boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending', 'uploaded', 'reviewed', 'resubmission_required')),
  storage_path text,
  storage_filename text,
  officer_note text,
  reviewed_by_person_id text,
  reviewed_at timestamptz,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_adi_application
    foreign key (tenant_id, application_id) references public.academy_admission_applications (tenant_id, id)
    on delete cascade
);

alter table public.academy_program_document_requirements enable row level security;
alter table public.academy_program_document_requirements force row level security;
create policy "tenant_isolation_pdr" on public.academy_program_document_requirements
  using (tenant_id = current_setting('app.academy_tenant_id', true));

alter table public.academy_application_document_items enable row level security;
alter table public.academy_application_document_items force row level security;
create policy "tenant_isolation_adi" on public.academy_application_document_items
  using (tenant_id = current_setting('app.academy_tenant_id', true));

create index idx_academy_program_document_requirements_program on public.academy_program_document_requirements (tenant_id, program_id);
create index idx_academy_application_document_items_application on public.academy_application_document_items (tenant_id, application_id);
