-- LMS circuit breaker state tracking
create table if not exists public.lms_circuit_breaker_state (
  tenant_id text not null,
  provider_id text not null,
  state text not null default 'closed' check (state in ('closed', 'open', 'half_open')),
  failure_count int not null default 0,
  last_failure_at timestamptz,
  opened_at timestamptz,
  last_probe_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, provider_id)
);

create index if not exists idx_lms_circuit_breaker_state_lookup
  on public.lms_circuit_breaker_state (tenant_id, provider_id, state);

comment on table public.lms_circuit_breaker_state is
  'Circuit breaker state for LMS provider integrations to prevent cascading failures';
