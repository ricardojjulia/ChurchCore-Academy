-- Application document upload tracking
-- ADR-0048: Application Document Checklist

create type academy_application_document_status as enum (
  'pending',
  'uploaded',
  'received',
  'waived'
);

create table academy_application_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  application_id uuid not null,
  document_type_id uuid not null references academy_document_types(id) on delete restrict,
  status academy_application_document_status not null default 'pending',
  storage_path text,
  uploaded_at timestamptz,
  uploaded_by uuid,
  received_at timestamptz,
  received_by uuid,
  waived_at timestamptz,
  waived_by uuid,
  waiver_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_application_documents_status_rules check (
    (status = 'pending' and storage_path is null and uploaded_at is null and received_at is null and waived_at is null and waiver_note is null)
    or (status = 'uploaded' and storage_path is not null and uploaded_at is not null and received_at is null and waived_at is null and waiver_note is null)
    or (status = 'received' and storage_path is not null and uploaded_at is not null and received_at is not null and waived_at is null and waiver_note is null)
    or (status = 'waived' and waived_at is not null and waived_by is not null and waiver_note is not null)
  ),
  constraint academy_application_documents_application_type_unique unique (application_id, document_type_id)
);

-- RLS for academy_application_documents
alter table academy_application_documents enable row level security;
alter table academy_application_documents force row level security;

-- Admissions staff can read all documents for their tenant
create policy "Admissions staff can read application documents"
  on academy_application_documents for select
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'admissions']
    )
  );

-- Applicants can read their own application documents
create policy "Applicants can read own application documents"
  on academy_application_documents for select
  using (
    exists (
      select 1 from academy_admission_applications
      where academy_admission_applications.id = academy_application_documents.application_id
        and academy_admission_applications.tenant_id = academy_application_documents.tenant_id
        and academy_admission_applications.applicant_person_id = academy_private.academy_current_person_id()
    )
  );

-- Admissions staff can manage all documents
create policy "Admissions staff can manage application documents"
  on academy_application_documents for all
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'admissions']
    )
  )
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'admissions']
    )
  );

-- Indexes
create index academy_application_documents_tenant_id_idx on academy_application_documents(tenant_id);
create index academy_application_documents_application_id_idx on academy_application_documents(application_id);
create index academy_application_documents_status_idx on academy_application_documents(status);
