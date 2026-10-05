-- HQ is a platform control-plane workspace. Replace its original tenant-role
-- policies with persisted platform-role checks so hiding the page is never the
-- authorization boundary.

create or replace function public.academy_is_active_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from public.academy_platform_role_assignments assignment
     where assignment.external_subject = auth.uid()::text
       and assignment.role in ('platform_staff', 'platform_admin')
       and assignment.status = 'active'
       and (assignment.starts_on is null or assignment.starts_on <= current_date)
       and (assignment.ends_on is null or assignment.ends_on >= current_date)
  );
$$;

create or replace function public.academy_is_active_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from public.academy_platform_role_assignments assignment
     where assignment.external_subject = auth.uid()::text
       and assignment.role = 'platform_admin'
       and assignment.status = 'active'
       and (assignment.starts_on is null or assignment.starts_on <= current_date)
       and (assignment.ends_on is null or assignment.ends_on >= current_date)
  );
$$;

revoke all on function public.academy_is_active_platform_staff() from public;
revoke all on function public.academy_is_active_platform_admin() from public;
grant execute on function public.academy_is_active_platform_staff() to authenticated, service_role;
grant execute on function public.academy_is_active_platform_admin() to authenticated, service_role;

alter table public.hq_sessions enable row level security;
alter table public.hq_sessions force row level security;
alter table public.hq_tasks enable row level security;
alter table public.hq_tasks force row level security;
alter table public.hq_risks enable row level security;
alter table public.hq_risks force row level security;
alter table public.hq_decisions enable row level security;
alter table public.hq_decisions force row level security;

grant select, insert, update, delete on table public.hq_sessions to authenticated;
grant select, insert, update, delete on table public.hq_tasks to authenticated;
grant select, insert, update, delete on table public.hq_risks to authenticated;
grant select, insert, update, delete on table public.hq_decisions to authenticated;

drop policy if exists "platform_admin_deny_all" on public.hq_sessions;
drop policy if exists "hq_sessions: users manage own" on public.hq_sessions;
drop policy if exists "hq_sessions: admins read all" on public.hq_sessions;
create policy hq_sessions_platform_owner
  on public.hq_sessions
  for all to authenticated
  using (public.academy_is_active_platform_staff() and user_id = auth.uid())
  with check (public.academy_is_active_platform_staff() and user_id = auth.uid());

drop policy if exists "hq_tasks: staff read all" on public.hq_tasks;
drop policy if exists "hq_tasks: managers+ write" on public.hq_tasks;
drop policy if exists "hq_tasks: managers+ update" on public.hq_tasks;
drop policy if exists "hq_tasks: admins delete" on public.hq_tasks;
create policy hq_tasks_platform_read
  on public.hq_tasks for select to authenticated
  using (public.academy_is_active_platform_staff());
create policy hq_tasks_platform_insert
  on public.hq_tasks for insert to authenticated
  with check (public.academy_is_active_platform_staff());
create policy hq_tasks_platform_update
  on public.hq_tasks for update to authenticated
  using (public.academy_is_active_platform_staff())
  with check (public.academy_is_active_platform_staff());
create policy hq_tasks_platform_admin_delete
  on public.hq_tasks for delete to authenticated
  using (public.academy_is_active_platform_admin());

drop policy if exists "hq_risks: staff read all" on public.hq_risks;
drop policy if exists "hq_risks: managers+ write" on public.hq_risks;
drop policy if exists "hq_risks: managers+ update" on public.hq_risks;
drop policy if exists "hq_risks: admins delete" on public.hq_risks;
create policy hq_risks_platform_read
  on public.hq_risks for select to authenticated
  using (public.academy_is_active_platform_staff());
create policy hq_risks_platform_insert
  on public.hq_risks for insert to authenticated
  with check (public.academy_is_active_platform_staff());
create policy hq_risks_platform_update
  on public.hq_risks for update to authenticated
  using (public.academy_is_active_platform_staff())
  with check (public.academy_is_active_platform_staff());
create policy hq_risks_platform_admin_delete
  on public.hq_risks for delete to authenticated
  using (public.academy_is_active_platform_admin());

drop policy if exists "hq_decisions: staff read all" on public.hq_decisions;
drop policy if exists "hq_decisions: managers+ write" on public.hq_decisions;
drop policy if exists "hq_decisions: managers+ update" on public.hq_decisions;
drop policy if exists "hq_decisions: admins delete" on public.hq_decisions;
create policy hq_decisions_platform_read
  on public.hq_decisions for select to authenticated
  using (public.academy_is_active_platform_staff());
create policy hq_decisions_platform_insert
  on public.hq_decisions for insert to authenticated
  with check (public.academy_is_active_platform_staff());
create policy hq_decisions_platform_update
  on public.hq_decisions for update to authenticated
  using (public.academy_is_active_platform_staff())
  with check (public.academy_is_active_platform_staff());
create policy hq_decisions_platform_admin_delete
  on public.hq_decisions for delete to authenticated
  using (public.academy_is_active_platform_admin());
