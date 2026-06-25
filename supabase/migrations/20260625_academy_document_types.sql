-- Application document types registry
-- ADR-0048: Application Document Checklist

create table academy_document_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  slug text not null,
  required boolean not null default false,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_document_types_tenant_slug_unique unique (tenant_id, slug)
);

-- RLS for academy_document_types
alter table academy_document_types enable row level security;

-- Staff with admissions or admin role can read active document types
create policy "Admissions staff can read document types"
  on academy_document_types for select
  using (
    exists (
      select 1 from academy_staff_roles
      where academy_staff_roles.tenant_id = academy_document_types.tenant_id
        and academy_staff_roles.person_id = auth.uid()
        and academy_staff_roles.role in ('institution_admin', 'dean', 'registrar', 'admissions')
    )
  );

-- Only institution_admin can insert/update document types
create policy "Institution admin can manage document types"
  on academy_document_types for all
  using (
    exists (
      select 1 from academy_staff_roles
      where academy_staff_roles.tenant_id = academy_document_types.tenant_id
        and academy_staff_roles.person_id = auth.uid()
        and academy_staff_roles.role = 'institution_admin'
    )
  );

-- Indexes
create index academy_document_types_tenant_id_idx on academy_document_types(tenant_id);
create index academy_document_types_tenant_active_idx on academy_document_types(tenant_id, active);
