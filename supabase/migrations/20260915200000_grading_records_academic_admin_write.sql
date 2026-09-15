-- The competency/narrative evaluation framework builder (this session's PR) gives
-- institution_admin AND academic_admin write access to grading configuration — but the RLS
-- write policy installed in 20260613010000_academy_auth_rls_audit.sql for these tables
-- (academy_tenant_admin_write, part of that migration's generic "configuration_tables" loop)
-- restricts writes to institution_admin only. An academic_admin write would pass the
-- application-layer role check in the new API routes and then fail at the database layer with
-- an opaque RLS violation. Found via code review before merge, not yet reproduced against a
-- live academic_admin session locally (local dev connects as a superuser that bypasses RLS),
-- but the policy mismatch is unambiguous from the migration source itself.
--
-- Scoped to only the four grading-configuration tables this PR adds write paths for — every
-- other table in that original migration's configuration_tables loop (institution profile,
-- calendar, courses, etc.) intentionally keeps institution_admin-only write and is untouched
-- here.

do $$
declare
  table_name text;
  grading_tables text[] := array[
    'academy_evaluation_scales',
    'academy_evaluation_scale_bands',
    'academy_evaluation_rule_sets',
    'academy_official_record_rules'
  ];
begin
  foreach table_name in array grading_tables loop
    execute format('drop policy if exists academy_tenant_admin_write on public.%I', table_name);
    execute format(
      'create policy academy_tenant_admin_write on public.%I for all using (
        academy_private.academy_has_active_role(tenant_id, array[''institution_admin'', ''academic_admin''])
      ) with check (
        academy_private.academy_has_active_role(tenant_id, array[''institution_admin'', ''academic_admin''])
      )',
      table_name
    );
  end loop;
end;
$$;
