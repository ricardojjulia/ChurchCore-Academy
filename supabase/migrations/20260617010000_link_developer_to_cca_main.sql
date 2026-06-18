-- ==========================================================
-- Link developer account to the cca-main demo tenant.
--
-- The demo seed data (students, faculty, programs, etc.) lives
-- under tenant_id = 'cca-main'. The developer's real Supabase
-- auth account (ricardojjulia@gmail.com) was created through
-- the platform UI and resolves to a different auto-named tenant,
-- so the demo data was invisible. This migration adds the
-- developer's auth user as a second account link for
-- person-regina-holt in cca-main with institution_admin and
-- platform_admin roles, and sets cca-main as their preferred
-- active tenant.
--
-- Idempotent: ON CONFLICT DO UPDATE on every upsert.
-- Safe to re-run after persona seed (20260616093000).
-- ==========================================================

do $$
declare
  v_developer_user_id text;
begin
  select id::text
  into v_developer_user_id
  from auth.users
  where lower(email) = 'ricardojjulia@gmail.com'
  limit 1;

  if v_developer_user_id is null then
    raise notice 'Developer account ricardojjulia@gmail.com not found in auth.users — skipping.';
    return;
  end if;

  -- Account link: developer → person-regina-holt in cca-main
  insert into public.academy_account_links (
    id,
    tenant_id,
    person_id,
    provider,
    external_subject,
    status,
    created_at,
    updated_at
  )
  values (
    'account-developer-rjulia',
    'cca-main',
    'person-regina-holt',
    'supabase',
    v_developer_user_id,
    'active',
    now(),
    now()
  )
  on conflict (id) do update
  set external_subject = excluded.external_subject,
      person_id        = excluded.person_id,
      status           = 'active',
      updated_at       = now();

  -- Deactivate any other active links for this auth user in cca-main
  -- (prevents ambiguous identity errors if they signed up via platform UI
  -- and a duplicate link exists under a different account-link ID).
  update public.academy_account_links
  set status     = 'inactive',
      updated_at = now()
  where tenant_id         = 'cca-main'
    and provider          = 'supabase'
    and external_subject  = v_developer_user_id
    and id               <> 'account-developer-rjulia';

  -- Platform admin role
  insert into public.academy_platform_role_assignments (
    external_subject,
    role,
    status,
    starts_on,
    ends_on,
    created_at,
    updated_at
  )
  values (
    v_developer_user_id,
    'platform_admin',
    'active',
    current_date,
    null,
    now(),
    now()
  )
  on conflict (external_subject, role) do update
  set status     = 'active',
      starts_on  = coalesce(public.academy_platform_role_assignments.starts_on, current_date),
      ends_on    = null,
      updated_at = now();

  -- Preferred active tenant → cca-main
  insert into public.academy_platform_user_preferences (
    external_subject,
    active_tenant_id,
    created_at,
    updated_at
  )
  values (
    v_developer_user_id,
    'cca-main',
    now(),
    now()
  )
  on conflict (external_subject) do update
  set active_tenant_id = 'cca-main',
      updated_at       = now();

  raise notice 'Developer account % linked to cca-main as institution_admin.', v_developer_user_id;
end
$$;
