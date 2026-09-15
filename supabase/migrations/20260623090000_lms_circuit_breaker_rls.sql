alter table public.lms_circuit_breaker_state enable row level security;
alter table public.lms_circuit_breaker_state force row level security;
create policy "tenant_isolation_lms_circuit_breaker" on public.lms_circuit_breaker_state
  using (tenant_id = current_setting('app.tenant_id', true));
