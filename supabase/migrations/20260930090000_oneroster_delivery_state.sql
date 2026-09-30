create table public.academy_oneroster_delivery_state (
  tenant_id text not null,
  destination_key text not null,
  scope_type text not null default 'section',
  scope_id text not null,
  record_type text not null,
  sourced_id text not null,
  payload jsonb not null,
  delivered_at timestamptz not null,
  primary key (tenant_id, destination_key, scope_type, scope_id, record_type, sourced_id),
  constraint academy_oneroster_delivery_state_destination_check
    check (destination_key = btrim(destination_key) and length(destination_key) between 1 and 160),
  constraint academy_oneroster_delivery_state_scope_check
    check (scope_type = 'section' and scope_id = btrim(scope_id) and length(scope_id) between 1 and 200),
  constraint academy_oneroster_delivery_state_record_type_check
    check (record_type in ('users', 'roles', 'classes', 'enrollments')),
  constraint academy_oneroster_delivery_state_payload_check
    check (jsonb_typeof(payload) = 'object' and payload ->> 'sourcedId' = sourced_id)
);

create index academy_oneroster_delivery_state_lookup_idx
  on public.academy_oneroster_delivery_state (tenant_id, destination_key, scope_id);

alter table public.academy_oneroster_delivery_state enable row level security;
alter table public.academy_oneroster_delivery_state force row level security;

revoke all on public.academy_oneroster_delivery_state from anon, authenticated;

create policy academy_oneroster_delivery_state_tenant_policy
  on public.academy_oneroster_delivery_state
  for all
  to authenticated
  using (tenant_id = nullif(current_setting('app.academy_tenant_id', true), ''))
  with check (tenant_id = nullif(current_setting('app.academy_tenant_id', true), ''));
