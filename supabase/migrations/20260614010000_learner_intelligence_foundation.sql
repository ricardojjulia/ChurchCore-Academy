create extension if not exists vector;

create unique index if not exists academy_courses_tenant_id_idx
  on public.academy_courses (tenant_id, id);

create table if not exists public.academy_learner_activity_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  learner_id text not null,
  course_id text,
  section_id text,
  module_id text,
  event_type text not null check (event_type in (
    'lesson_start', 'lesson_complete', 'lesson_abandon',
    'quiz_attempt', 'quiz_pass', 'quiz_fail',
    'assignment_submit', 'assignment_retry',
    'video_play', 'video_pause', 'video_scrub_back',
    'discussion_post', 'discussion_reply',
    'ai_tutor_session_start', 'ai_tutor_session_end',
    'session_start', 'session_end',
    'energy_checkin'
  )),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, learner_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, course_id)
    references public.academy_courses (tenant_id, id) on delete restrict,
  constraint academy_learner_activity_events_no_future
    check (occurred_at <= now() + interval '5 minutes')
);

create index if not exists academy_learner_activity_events_tenant_learner_time_idx
  on public.academy_learner_activity_events (tenant_id, learner_id, occurred_at desc);

create index if not exists academy_learner_activity_events_tenant_course_time_idx
  on public.academy_learner_activity_events (tenant_id, course_id, occurred_at desc);

create index if not exists academy_learner_activity_events_tenant_type_time_idx
  on public.academy_learner_activity_events (tenant_id, event_type, occurred_at desc);

create table if not exists public.academy_learner_intelligence_consent (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  learner_id text not null,
  consent_behavioral_tracking boolean not null default false,
  consent_ai_memory boolean not null default false,
  consent_social_graph boolean not null default false,
  consent_predictive_modeling boolean not null default false,
  consent_learner_mirror boolean not null default false,
  consented_at timestamptz not null default now(),
  consent_version text not null,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, learner_id, consent_version),
  foreign key (tenant_id, learner_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_learner_intelligence_consent_tenant_learner_idx
  on public.academy_learner_intelligence_consent (tenant_id, learner_id, consented_at desc);

create table if not exists public.academy_learner_memory (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  learner_id text not null,
  course_id text,
  memory_type text not null check (memory_type in (
    'struggle_pattern',
    'strength_signal',
    'optimal_time_window',
    'content_format_preference',
    'social_learning_bond',
    'breakthrough_moment',
    'communication_style_signal',
    'motivation_pattern'
  )),
  sensitivity_level text not null default 'standard'
    check (sensitivity_level in ('standard', 'pastoral', 'confidential')),
  content text not null,
  embedding vector(1536),
  initial_confidence double precision not null check (initial_confidence between 0 and 1),
  confidence_decay_rate double precision not null default 0.02
    check (confidence_decay_rate between 0 and 1),
  source_event_ids uuid[] not null default '{}'::uuid[],
  generation_model text,
  human_reviewed boolean not null default false,
  observed_at timestamptz not null default now(),
  expires_at timestamptz,
  superseded_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, learner_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, course_id)
    references public.academy_courses (tenant_id, id) on delete restrict,
  foreign key (tenant_id, superseded_by)
    references public.academy_learner_memory (tenant_id, id) on delete restrict
);

create or replace view public.academy_learner_memory_with_confidence
with (security_invoker = true) as
select
  memory.*,
  memory.initial_confidence * exp(
    -memory.confidence_decay_rate * extract(epoch from (now() - memory.observed_at)) / 86400
  ) as current_confidence
from public.academy_learner_memory memory
where memory.superseded_by is null
  and (memory.expires_at is null or memory.expires_at > now());

create index if not exists academy_learner_memory_tenant_learner_type_idx
  on public.academy_learner_memory (tenant_id, learner_id, memory_type);

create index if not exists academy_learner_memory_embedding_idx
  on public.academy_learner_memory using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists public.academy_learner_identity_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  learner_id text not null,
  snapshot_date date not null,
  momentum_score integer not null check (momentum_score between 0 and 100),
  engagement_velocity text not null
    check (engagement_velocity in ('accelerating', 'stable', 'decelerating', 'dormant')),
  cognitive_load_index double precision check (cognitive_load_index between 0 and 1),
  dark_period_risk double precision check (dark_period_risk between 0 and 1),
  events_analyzed_count integer not null check (events_analyzed_count >= 0),
  computation_model_version text not null,
  computation_notes text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, learner_id, snapshot_date),
  foreign key (tenant_id, learner_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_learner_identity_snapshots_tenant_learner_date_idx
  on public.academy_learner_identity_snapshots (tenant_id, learner_id, snapshot_date desc);

create table if not exists public.academy_energy_checkins (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  learner_id text not null,
  energy_level text not null check (energy_level in ('empty', 'low', 'medium', 'high', 'flow')),
  session_id text,
  checked_in_at timestamptz not null default now(),
  session_completed boolean,
  content_completed_count integer check (content_completed_count >= 0),
  quiz_score_avg double precision check (quiz_score_avg between 0 and 100),
  unique (tenant_id, id),
  foreign key (tenant_id, learner_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_energy_checkins_tenant_learner_checked_idx
  on public.academy_energy_checkins (tenant_id, learner_id, checked_in_at desc);

create table if not exists public.academy_intervention_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  learner_id text not null,
  course_id text,
  risk_score double precision not null check (risk_score between 0 and 1),
  risk_horizon timestamptz,
  risk_type text not null
    check (risk_type in ('dark_period', 'low_momentum', 'concept_struggle', 'social_isolation')),
  root_cause_hypotheses text[] not null default '{}'::text[],
  recommended_actions jsonb not null default '[]'::jsonb,
  assigned_to_user_id text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'acted_on', 'dismissed', 'expired')),
  instructor_notes text,
  acted_at timestamptz,
  outcome_snapshot_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '21 days',
  unique (tenant_id, id),
  foreign key (tenant_id, learner_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, course_id)
    references public.academy_courses (tenant_id, id) on delete restrict,
  foreign key (tenant_id, assigned_to_user_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, outcome_snapshot_id)
    references public.academy_learner_identity_snapshots (tenant_id, id) on delete restrict
);

create index if not exists academy_intervention_recommendations_tenant_status_idx
  on public.academy_intervention_recommendations (tenant_id, status, created_at desc);

create index if not exists academy_intervention_recommendations_tenant_learner_idx
  on public.academy_intervention_recommendations (tenant_id, learner_id, created_at desc);

create or replace function academy_private.academy_reject_immutable_learner_intelligence_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

revoke all on function academy_private.academy_reject_immutable_learner_intelligence_change() from public;

drop trigger if exists academy_learner_activity_events_immutable
  on public.academy_learner_activity_events;
create trigger academy_learner_activity_events_immutable
before update or delete on public.academy_learner_activity_events
for each row execute function academy_private.academy_reject_immutable_learner_intelligence_change();

drop trigger if exists academy_learner_memory_immutable
  on public.academy_learner_memory;
create trigger academy_learner_memory_immutable
before update or delete on public.academy_learner_memory
for each row execute function academy_private.academy_reject_immutable_learner_intelligence_change();

drop trigger if exists academy_learner_identity_snapshots_immutable
  on public.academy_learner_identity_snapshots;
create trigger academy_learner_identity_snapshots_immutable
before update or delete on public.academy_learner_identity_snapshots
for each row execute function academy_private.academy_reject_immutable_learner_intelligence_change();
