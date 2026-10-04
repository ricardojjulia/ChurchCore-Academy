-- ADR 0078 follow-up: enforce the AI gateway's append-only routing history and serialize
-- evaluation runs.
--
-- 1. Evaluation runs, graded evaluations, and model selections are history that explains why each
--    ask is routed where it is. Like transcript entries, they reject UPDATE and DELETE for every
--    role, so routing history cannot be rewritten after the fact.
-- 2. A single-row lease keeps the scheduled cron and an admin-triggered run from evaluating at the
--    same time (they would read the same incumbent, spend separate budgets, and race selections).

create or replace function public.academy_reject_ai_gateway_history_mutation()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  raise exception 'AI gateway history is append-only.';
end;
$$;

create trigger academy_ai_evaluation_runs_immutable
before update or delete on public.academy_ai_evaluation_runs
for each row execute function public.academy_reject_ai_gateway_history_mutation();

create trigger academy_ai_model_evaluations_immutable
before update or delete on public.academy_ai_model_evaluations
for each row execute function public.academy_reject_ai_gateway_history_mutation();

create trigger academy_ai_model_selections_immutable
before update or delete on public.academy_ai_model_selections
for each row execute function public.academy_reject_ai_gateway_history_mutation();

revoke update, delete, truncate on public.academy_ai_evaluation_runs from service_role;
revoke update, delete, truncate on public.academy_ai_model_evaluations from service_role;
revoke update, delete, truncate on public.academy_ai_model_selections from service_role;

create table public.academy_ai_evaluation_lease (
  lease_key text primary key check (lease_key = 'model_evaluation'),
  holder_id text not null,
  acquired_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > acquired_at)
);

alter table public.academy_ai_evaluation_lease enable row level security;
alter table public.academy_ai_evaluation_lease force row level security;

revoke all on public.academy_ai_evaluation_lease from anon, authenticated;
