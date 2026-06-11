create extension if not exists pgcrypto;

create table if not exists academy_demo_feedback (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  session_id uuid not null,
  route text not null,
  category text not null check (category in ('BUG', 'ERROR', 'UNEXPECTED_RESULT', 'IMPROVEMENT')),
  error_message text,
  note text,
  breadcrumbs jsonb not null default '[]'::jsonb,
  user_email text,
  user_role text,
  demo_version text not null,
  session_duration_seconds integer check (
    session_duration_seconds is null
    or (session_duration_seconds >= 0 and session_duration_seconds <= 2592000)
  ),
  hit_count integer not null default 1 check (hit_count >= 1),
  metadata jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  action text check (
    action is null
    or action in (
      'code_fixed',
      'update_applied',
      'suggestion_not_implemented',
      'suggestion_implemented',
      'bug_fixed',
      'error_fixed',
      'received_and_closed'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(route) between 1 and 500),
  check (error_message is null or char_length(error_message) <= 4000),
  check (note is null or char_length(note) <= 2000),
  check (char_length(demo_version) between 1 and 100),
  check (jsonb_typeof(breadcrumbs) = 'array')
);

create table if not exists academy_demo_feedback_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  accepted_count integer not null check (accepted_count >= 0)
);

create index if not exists academy_demo_feedback_route_idx
  on academy_demo_feedback (route);

create index if not exists academy_demo_feedback_category_idx
  on academy_demo_feedback (category);

create index if not exists academy_demo_feedback_session_id_idx
  on academy_demo_feedback (session_id);

create index if not exists academy_demo_feedback_created_desc_idx
  on academy_demo_feedback (created_at desc);

alter table academy_demo_feedback enable row level security;

create or replace function academy_is_platform_staff()
returns boolean
language sql
stable
as $$
  select
    coalesce((auth.jwt() ->> 'role') in ('service_role', 'platform_staff', 'platform_admin'), false)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('platform_staff', 'platform_admin'), false);
$$;

create policy if not exists academy_demo_feedback_staff_select
  on academy_demo_feedback
  for select
  using (academy_is_platform_staff());

create policy if not exists academy_demo_feedback_staff_update
  on academy_demo_feedback
  for update
  using (academy_is_platform_staff())
  with check (academy_is_platform_staff());

drop function if exists public.submit_demo_feedback(uuid, text, text, text, text, jsonb, text, text, text, integer, text, jsonb);

create or replace function academy_submit_demo_feedback(
  p_session_id uuid,
  p_route text,
  p_category text,
  p_error_message text,
  p_note text,
  p_breadcrumbs jsonb,
  p_user_email text,
  p_user_role text,
  p_demo_version text,
  p_session_duration_seconds integer,
  p_fingerprint text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(status text, feedback_row jsonb)
language plpgsql
security invoker
as $$
declare
  v_key_hash text;
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
  v_record academy_demo_feedback%rowtype;
begin
  v_key_hash := encode(digest(lower(trim(p_session_id::text)), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(v_key_hash, 0));

  select window_started_at, accepted_count
  into v_window_start, v_count
  from academy_demo_feedback_rate_limits
  where key_hash = v_key_hash
  for update;

  if not found then
    insert into academy_demo_feedback_rate_limits (key_hash, window_started_at, accepted_count)
    values (v_key_hash, v_now, 1);
  else
    if v_now - v_window_start >= interval '60 seconds' then
      update academy_demo_feedback_rate_limits
      set window_started_at = v_now,
          accepted_count = 1
      where key_hash = v_key_hash;
    elsif v_count >= 20 then
      return query select 'rate_limited'::text, null::jsonb;
      return;
    else
      update academy_demo_feedback_rate_limits
      set accepted_count = accepted_count + 1
      where key_hash = v_key_hash;
    end if;
  end if;

  if random() < 0.05 then
    delete from academy_demo_feedback_rate_limits
    where window_started_at < v_now - interval '1 day';
  end if;

  insert into academy_demo_feedback (
    fingerprint,
    session_id,
    route,
    category,
    error_message,
    note,
    breadcrumbs,
    user_email,
    user_role,
    demo_version,
    session_duration_seconds,
    metadata
  )
  values (
    p_fingerprint,
    p_session_id,
    p_route,
    p_category,
    p_error_message,
    p_note,
    coalesce(p_breadcrumbs, '[]'::jsonb),
    p_user_email,
    p_user_role,
    p_demo_version,
    p_session_duration_seconds,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (fingerprint)
  do update
    set session_id = excluded.session_id,
        route = excluded.route,
        category = excluded.category,
        error_message = excluded.error_message,
        note = excluded.note,
        breadcrumbs = excluded.breadcrumbs,
        user_email = excluded.user_email,
        user_role = excluded.user_role,
        demo_version = excluded.demo_version,
        session_duration_seconds = excluded.session_duration_seconds,
        hit_count = academy_demo_feedback.hit_count + 1,
        metadata = excluded.metadata,
        processed = false,
        action = null,
        updated_at = now()
  returning * into v_record;

  return query select 'accepted'::text, to_jsonb(v_record);
end;
$$;

revoke all on function academy_submit_demo_feedback(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  integer,
  text,
  jsonb
) from public;

revoke all on function academy_submit_demo_feedback(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  integer,
  text,
  jsonb
) from anon;

revoke all on function academy_submit_demo_feedback(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  integer,
  text,
  jsonb
) from authenticated;

grant execute on function academy_submit_demo_feedback(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  integer,
  text,
  jsonb
) to service_role;
