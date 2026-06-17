-- Remove the auto-created "UI Button 119445" tenant that was generated
-- when the platform control panel was opened during local development.
-- All real seed data lives under cca-main; this tenant has no legitimate data.
--
-- Deletes in FK-safe order: assignments → people → subdivisions/calendar → profile.
-- Also resets the platform user preference back to cca-main for the admin account.

do $$
declare
  v_dead_tenant text := 'cca-ui-btn-119445';
begin
  if not exists (
    select 1 from public.academy_institution_profiles where tenant_id = v_dead_tenant
  ) then
    raise notice 'Tenant % not found — nothing to remove.', v_dead_tenant;
    return;
  end if;

  -- Role assignments
  delete from public.academy_person_role_assignments where tenant_id = v_dead_tenant;

  -- Account links
  delete from public.academy_account_links where tenant_id = v_dead_tenant;

  -- Student / staff profiles
  delete from public.academy_student_profiles where tenant_id = v_dead_tenant;
  delete from public.academy_staff_profiles   where tenant_id = v_dead_tenant;

  -- People
  delete from public.academy_people where tenant_id = v_dead_tenant;

  -- Calendar and subdivisions
  delete from public.academy_academic_periods     where tenant_id = v_dead_tenant;
  delete from public.academy_academic_years       where tenant_id = v_dead_tenant;
  delete from public.academy_institution_subdivisions where tenant_id = v_dead_tenant;
  delete from public.academy_calendar_profiles    where tenant_id = v_dead_tenant;

  -- Institution profile (last — other tables FK to this)
  delete from public.academy_institution_profiles where tenant_id = v_dead_tenant;

  -- Reset platform user preferences that were pointing at the dead tenant
  update public.academy_platform_user_preferences
  set active_tenant_id = 'cca-main', updated_at = now()
  where active_tenant_id = v_dead_tenant;

  raise notice 'Tenant % removed. Platform preferences reset to cca-main.', v_dead_tenant;
end
$$;
