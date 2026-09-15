-- Tenant-scoped LMS provider activation configuration and secret references.
create table if not exists public.lms_provider_configs (
  tenant_id text not null,
  provider_id text not null check (provider_id in ('moodle', 'canvas')),
  base_url text not null,
  activation_status text not null default 'planned'
    check (activation_status in ('planned', 'active', 'paused', 'validation_failed')),
  launch_mode text not null check (launch_mode in ('oidc', 'lti', 'oauth2')),
  enabled_operations jsonb not null default '[]'::jsonb,
  provider_context jsonb not null default '{}'::jsonb,
  last_validation jsonb,
  last_successful_operation_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, provider_id)
);

create index if not exists lms_provider_configs_tenant_status_idx
  on public.lms_provider_configs (tenant_id, provider_id, activation_status);

create table if not exists public.lms_provider_secret_refs (
  tenant_id text not null,
  provider_id text not null check (provider_id in ('moodle', 'canvas')),
  secret_name text not null,
  secret_ref text not null,
  rotation_required boolean not null default false,
  last_rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, provider_id, secret_name),
  foreign key (tenant_id, provider_id)
    references public.lms_provider_configs (tenant_id, provider_id)
    on delete cascade
);

create index if not exists lms_provider_secret_refs_rotation_idx
  on public.lms_provider_secret_refs (tenant_id, provider_id, rotation_required);

comment on table public.lms_provider_configs is
  'Non-secret tenant LMS provider activation configuration for Moodle and Canvas.';

comment on table public.lms_provider_secret_refs is
  'Tenant LMS provider secret references only; secret values remain in the encrypted provider secret layer.';

alter table public.lms_provider_configs enable row level security;
alter table public.lms_provider_configs force row level security;

alter table public.lms_provider_secret_refs enable row level security;
alter table public.lms_provider_secret_refs force row level security;

create policy "tenant_isolation_lms_provider_configs" on public.lms_provider_configs
  using (tenant_id = current_setting('app.tenant_id', true))
  with check (tenant_id = current_setting('app.tenant_id', true));

create policy "tenant_isolation_lms_provider_secret_refs" on public.lms_provider_secret_refs
  using (tenant_id = current_setting('app.tenant_id', true))
  with check (tenant_id = current_setting('app.tenant_id', true));
