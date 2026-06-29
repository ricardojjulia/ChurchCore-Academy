-- Application document types registry
-- ADR-0048: Application Document Checklist

create table academy_document_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
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
alter table academy_document_types force row level security;

-- Staff with admissions or admin role can read active document types
create policy "Admissions staff can read document types"
  on academy_document_types for select
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'admissions']
    )
  );

-- Only institution_admin can insert/update document types
create policy "Institution admin can manage document types"
  on academy_document_types for all
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin']
    )
  )
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin']
    )
  );

-- Indexes
create index academy_document_types_tenant_id_idx on academy_document_types(tenant_id);
create index academy_document_types_tenant_active_idx on academy_document_types(tenant_id, active);
