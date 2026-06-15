create table if not exists public.academy_platform_role_assignments (
  id uuid primary key default gen_random_uuid(),
  external_subject text not null,
  role text not null check (role in ('platform_staff', 'platform_admin')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_subject, role)
);

create table if not exists public.academy_tenant_registry (
  tenant_id text primary key references public.academy_institution_profiles(tenant_id) on delete cascade,
  display_name text not null,
  tenant_kind text not null default 'academy',
  lifecycle_status text not null default 'development'
    check (lifecycle_status in ('demo', 'development', 'trial', 'active', 'suspended', 'archived')),
  is_demo boolean not null default false,
  provisioning_status text not null default 'ready'
    check (provisioning_status in ('pending', 'ready', 'failed')),
  created_by_external_subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_platform_user_preferences (
  external_subject text primary key,
  active_tenant_id text not null references public.academy_tenant_registry(tenant_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  external_subject text not null,
  tenant_id text references public.academy_tenant_registry(tenant_id) on delete set null,
  event_type text not null check (
    event_type in (
      'tenant_selected',
      'tenant_created',
      'tenant_user_provisioned',
      'tenant_provisioning_completed',
      'tenant_provisioning_failed'
    )
  ),
  redacted_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists academy_platform_role_assignments_subject_idx
  on public.academy_platform_role_assignments (external_subject, status, role);

create index if not exists academy_tenant_registry_lifecycle_idx
  on public.academy_tenant_registry (lifecycle_status, is_demo, updated_at desc);

create index if not exists academy_platform_audit_events_subject_time_idx
  on public.academy_platform_audit_events (external_subject, occurred_at desc);

alter table public.academy_platform_role_assignments enable row level security;
alter table public.academy_platform_role_assignments force row level security;

alter table public.academy_tenant_registry enable row level security;
alter table public.academy_tenant_registry force row level security;

alter table public.academy_platform_user_preferences enable row level security;
alter table public.academy_platform_user_preferences force row level security;

alter table public.academy_platform_audit_events enable row level security;
alter table public.academy_platform_audit_events force row level security;

drop policy if exists academy_platform_roles_self_read on public.academy_platform_role_assignments;
create policy academy_platform_roles_self_read
  on public.academy_platform_role_assignments
  for select to authenticated
  using (external_subject = auth.uid()::text);

drop policy if exists academy_platform_preferences_self_manage on public.academy_platform_user_preferences;
create policy academy_platform_preferences_self_manage
  on public.academy_platform_user_preferences
  for all to authenticated
  using (external_subject = auth.uid()::text)
  with check (external_subject = auth.uid()::text);

drop policy if exists academy_platform_audit_self_read on public.academy_platform_audit_events;
create policy academy_platform_audit_self_read
  on public.academy_platform_audit_events
  for select to authenticated
  using (external_subject = auth.uid()::text);

insert into public.academy_tenant_registry (
  tenant_id,
  display_name,
  tenant_kind,
  lifecycle_status,
  is_demo,
  provisioning_status,
  created_by_external_subject
)
select
  profile.tenant_id,
  profile.institution_name,
  profile.primary_mode,
  case when profile.tenant_id = 'cca-main' then 'demo' else 'development' end,
  profile.tenant_id = 'cca-main',
  'ready',
  null
from public.academy_institution_profiles profile
where not exists (
  select 1
  from public.academy_tenant_registry registry
  where registry.tenant_id = profile.tenant_id
);