create table if not exists public.academy_public_institution_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  route_type text not null check (route_type in ('host', 'slug')),
  route_value text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_public_institution_routes_value_normalized_check
    check (
      route_value = lower(trim(route_value))
      and route_value !~ ':[0-9]+$'
      and (
        (route_type = 'host' and route_value ~ '^[a-z0-9][a-z0-9.-]{0,251}[a-z0-9]$')
        or (route_type = 'slug' and route_value ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
      )
    ),
  unique (route_type, route_value)
);

create index if not exists academy_public_institution_routes_tenant_idx
  on public.academy_public_institution_routes (tenant_id);

create index if not exists academy_public_institution_routes_lookup_idx
  on public.academy_public_institution_routes (route_type, route_value)
  where published_at is not null;

alter table public.academy_public_institution_routes enable row level security;
alter table public.academy_public_institution_routes force row level security;

revoke all on public.academy_public_institution_routes from anon;
revoke all on public.academy_public_institution_routes from authenticated;

insert into public.academy_public_institution_routes (
  tenant_id,
  route_type,
  route_value,
  published_at
)
values
  ('cca-main', 'host', 'localhost', now()),
  ('cca-main', 'host', '127.0.0.1', now()),
  ('cca-main', 'slug', 'churchcore-academy', now())
on conflict (route_type, route_value) do update
set tenant_id = excluded.tenant_id,
    published_at = excluded.published_at,
    updated_at = now();
