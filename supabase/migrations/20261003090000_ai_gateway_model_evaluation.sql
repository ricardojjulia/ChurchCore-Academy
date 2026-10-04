-- ADR 0078: OpenRouter AI gateway with continuous model evaluation.
-- Platform-level tables (not tenant data). They hold synthetic evaluation results, model
-- routing selections, and per-call usage metering — never prompts or completions from real use.
-- Access is server-side only through the service pool; anon/authenticated have no grants.

create table public.academy_ai_evaluation_runs (
  run_id uuid primary key,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  status text not null check (status in ('completed', 'budget_exhausted', 'deadline_reached', 'failed')),
  spent_usd numeric(12, 6) not null default 0 check (spent_usd >= 0),
  evaluated_model_count integer not null default 0 check (evaluated_model_count >= 0),
  selection_changes jsonb not null default '[]'::jsonb
);

create index academy_ai_evaluation_runs_started_idx
  on public.academy_ai_evaluation_runs (started_at desc);

create table public.academy_ai_model_evaluations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  task_kind text not null,
  case_id text not null,
  model_id text not null,
  status text not null check (status in ('graded', 'failed')),
  quality_score numeric(6, 5) not null check (quality_score between 0 and 1),
  judge_score numeric(6, 5) not null check (judge_score between 0 and 1),
  deterministic_score numeric(6, 5) not null check (deterministic_score between 0 and 1),
  latency_ms integer not null check (latency_ms >= 0),
  prompt_tokens integer not null check (prompt_tokens >= 0),
  completion_tokens integer not null check (completion_tokens >= 0),
  cost_usd numeric(12, 6) not null check (cost_usd >= 0),
  grader_model_id text not null,
  grader_rationale text not null default '',
  output_excerpt text not null default '' check (char_length(output_excerpt) <= 2000),
  evaluated_at timestamptz not null,
  unique (run_id, task_kind, case_id, model_id)
);

create index academy_ai_model_evaluations_task_time_idx
  on public.academy_ai_model_evaluations (task_kind, evaluated_at desc);

-- Append-only history; the current selection for a task kind is its newest row.
create table public.academy_ai_model_selections (
  id uuid primary key default gen_random_uuid(),
  task_kind text not null,
  model_id text not null,
  fallback_model_ids text[] not null default '{}',
  fit_score numeric(6, 5),
  reason text not null,
  run_id uuid,
  selected_at timestamptz not null
);

create index academy_ai_model_selections_task_time_idx
  on public.academy_ai_model_selections (task_kind, selected_at desc);

create table public.academy_ai_gateway_usage (
  id uuid primary key default gen_random_uuid(),
  task_kind text not null,
  model_id text not null,
  prompt_tokens integer not null check (prompt_tokens >= 0),
  completion_tokens integer not null check (completion_tokens >= 0),
  cost_usd numeric(12, 6) check (cost_usd is null or cost_usd >= 0),
  latency_ms integer not null check (latency_ms >= 0),
  status text not null check (status in ('completed', 'failed')),
  created_at timestamptz not null
);

create index academy_ai_gateway_usage_created_idx
  on public.academy_ai_gateway_usage (created_at desc);

alter table public.academy_ai_evaluation_runs enable row level security;
alter table public.academy_ai_evaluation_runs force row level security;
alter table public.academy_ai_model_evaluations enable row level security;
alter table public.academy_ai_model_evaluations force row level security;
alter table public.academy_ai_model_selections enable row level security;
alter table public.academy_ai_model_selections force row level security;
alter table public.academy_ai_gateway_usage enable row level security;
alter table public.academy_ai_gateway_usage force row level security;

revoke all on public.academy_ai_evaluation_runs from anon, authenticated;
revoke all on public.academy_ai_model_evaluations from anon, authenticated;
revoke all on public.academy_ai_model_selections from anon, authenticated;
revoke all on public.academy_ai_gateway_usage from anon, authenticated;
