-- ==========================================================
-- ADR-0027: Platform-admin table RLS
-- All platform-admin and cross-tenant tables must deny
-- anon/authenticated role access. Service-role key (used by
-- all API routes via getDatabasePool()) bypasses RLS and is
-- unaffected.
-- ==========================================================

-- academy_tenant_registry
alter table public.academy_tenant_registry enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'academy_tenant_registry'
      and policyname = 'platform_admin_deny_all'
  ) then
    execute $p$
      create policy "platform_admin_deny_all"
        on public.academy_tenant_registry
        as restrictive
        for all
        to authenticated, anon
        using (false)
    $p$;
  end if;
end $$;

-- academy_platform_role_assignments
alter table public.academy_platform_role_assignments enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'academy_platform_role_assignments'
      and policyname = 'platform_admin_deny_all'
  ) then
    execute $p$
      create policy "platform_admin_deny_all"
        on public.academy_platform_role_assignments
        as restrictive
        for all
        to authenticated, anon
        using (false)
    $p$;
  end if;
end $$;

-- academy_platform_user_preferences
alter table public.academy_platform_user_preferences enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'academy_platform_user_preferences'
      and policyname = 'platform_admin_deny_all'
  ) then
    execute $p$
      create policy "platform_admin_deny_all"
        on public.academy_platform_user_preferences
        as restrictive
        for all
        to authenticated, anon
        using (false)
    $p$;
  end if;
end $$;

-- academy_platform_audit_events
alter table public.academy_platform_audit_events enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'academy_platform_audit_events'
      and policyname = 'platform_admin_deny_all'
  ) then
    execute $p$
      create policy "platform_admin_deny_all"
        on public.academy_platform_audit_events
        as restrictive
        for all
        to authenticated, anon
        using (false)
    $p$;
  end if;
end $$;

-- academy_student_number_sequences
alter table public.academy_student_number_sequences enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'academy_student_number_sequences'
      and policyname = 'platform_admin_deny_all'
  ) then
    execute $p$
      create policy "platform_admin_deny_all"
        on public.academy_student_number_sequences
        as restrictive
        for all
        to authenticated, anon
        using (false)
    $p$;
  end if;
end $$;

-- hq_sessions
alter table public.hq_sessions enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'hq_sessions'
      and policyname = 'platform_admin_deny_all'
  ) then
    execute $p$
      create policy "platform_admin_deny_all"
        on public.hq_sessions
        as restrictive
        for all
        to authenticated, anon
        using (false)
    $p$;
  end if;
end $$;
