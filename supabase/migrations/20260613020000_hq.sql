create extension if not exists pgcrypto;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    'student'
  );
$$;

create table if not exists public.hq_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  agent_id text not null,
  agent_name text not null,
  prompt text not null,
  response text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_hq_sessions_user_agent on public.hq_sessions(user_id, agent_id);
create index if not exists idx_hq_sessions_created on public.hq_sessions(created_at desc);

alter table public.hq_sessions enable row level security;
alter table public.hq_sessions force row level security;

drop policy if exists "hq_sessions: users manage own" on public.hq_sessions;
create policy "hq_sessions: users manage own"
  on public.hq_sessions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "hq_sessions: admins read all" on public.hq_sessions;
create policy "hq_sessions: admins read all"
  on public.hq_sessions
  for select
  using (public.current_user_role() = 'admin');

create table if not exists public.hq_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'backlog' check (status in ('backlog','ready','in_progress','review','blocked','done')),
  owner text,
  priority text not null default 'P2' check (priority in ('P0','P1','P2','P3')),
  source text not null default 'manual' check (source in ('manual','risk','council')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hq_tasks enable row level security;
alter table public.hq_tasks force row level security;

drop policy if exists "hq_tasks: staff read all" on public.hq_tasks;
create policy "hq_tasks: staff read all"
  on public.hq_tasks
  for select to authenticated
  using (public.current_user_role() in ('admin','manager','teacher'));

drop policy if exists "hq_tasks: managers+ write" on public.hq_tasks;
create policy "hq_tasks: managers+ write"
  on public.hq_tasks
  for insert to authenticated
  with check (public.current_user_role() in ('admin','manager'));

drop policy if exists "hq_tasks: managers+ update" on public.hq_tasks;
create policy "hq_tasks: managers+ update"
  on public.hq_tasks
  for update to authenticated
  using (public.current_user_role() in ('admin','manager'))
  with check (public.current_user_role() in ('admin','manager'));

drop policy if exists "hq_tasks: admins delete" on public.hq_tasks;
create policy "hq_tasks: admins delete"
  on public.hq_tasks
  for delete to authenticated
  using (public.current_user_role() = 'admin');

create table if not exists public.hq_risks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  mitigation text,
  severity int not null default 3 check (severity between 1 and 5),
  probability int not null default 3 check (probability between 1 and 5),
  owner text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.hq_risks enable row level security;
alter table public.hq_risks force row level security;

drop policy if exists "hq_risks: staff read all" on public.hq_risks;
create policy "hq_risks: staff read all"
  on public.hq_risks
  for select to authenticated
  using (public.current_user_role() in ('admin','manager','teacher'));

drop policy if exists "hq_risks: managers+ write" on public.hq_risks;
create policy "hq_risks: managers+ write"
  on public.hq_risks
  for insert to authenticated
  with check (public.current_user_role() in ('admin','manager'));

drop policy if exists "hq_risks: managers+ update" on public.hq_risks;
create policy "hq_risks: managers+ update"
  on public.hq_risks
  for update to authenticated
  using (public.current_user_role() in ('admin','manager'))
  with check (public.current_user_role() in ('admin','manager'));

drop policy if exists "hq_risks: admins delete" on public.hq_risks;
create policy "hq_risks: admins delete"
  on public.hq_risks
  for delete to authenticated
  using (public.current_user_role() = 'admin');

create table if not exists public.hq_decisions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner text,
  status text not null default 'Proposed' check (status in ('Proposed','Accepted','Rejected','Superseded')),
  impact text not null default 'Medium' check (impact in ('Critical','High','Medium','Low')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.hq_decisions enable row level security;
alter table public.hq_decisions force row level security;

drop policy if exists "hq_decisions: staff read all" on public.hq_decisions;
create policy "hq_decisions: staff read all"
  on public.hq_decisions
  for select to authenticated
  using (public.current_user_role() in ('admin','manager','teacher'));

drop policy if exists "hq_decisions: managers+ write" on public.hq_decisions;
create policy "hq_decisions: managers+ write"
  on public.hq_decisions
  for insert to authenticated
  with check (public.current_user_role() in ('admin','manager'));

drop policy if exists "hq_decisions: managers+ update" on public.hq_decisions;
create policy "hq_decisions: managers+ update"
  on public.hq_decisions
  for update to authenticated
  using (public.current_user_role() in ('admin','manager'))
  with check (public.current_user_role() in ('admin','manager'));

drop policy if exists "hq_decisions: admins delete" on public.hq_decisions;
create policy "hq_decisions: admins delete"
  on public.hq_decisions
  for delete to authenticated
  using (public.current_user_role() = 'admin');

insert into public.hq_decisions (title, owner, status, impact)
select *
from (
  values
    ('Use Supabase RLS as authorization source of truth', 'Security Officer', 'Accepted', 'Critical'),
    ('Model lessons as canvas block model (flat course_blocks table)', 'The Architect', 'Accepted', 'High'),
    ('Separate Project HQ governance from LMS runtime tables', 'The Engineer', 'Accepted', 'Medium'),
    ('shadcn/ui as UI component library (ADR-0012)', 'The Architect', 'Accepted', 'Medium'),
    ('Two-layer identity split: profiles.uid vs profiles.auth_id (ADR-0004)', 'The Engineer', 'Accepted', 'Critical')
) as seed(title, owner, status, impact)
where not exists (select 1 from public.hq_decisions limit 1);

insert into public.hq_risks (title, mitigation, severity, probability, owner)
select *
from (
  values
    ('RLS policy gaps may expose student records', 'Policy tests for every student/teacher/admin path.', 5, 3, 'Security Officer'),
    ('Feature bloat could delay MVP', 'Phase-gate roadmap and MVP acceptance criteria.', 4, 4, 'Product Manager'),
    ('AI tutor may provide unsupervised incorrect guidance', 'Teacher-owned sources, retrieval citations, safe refusal patterns.', 4, 3, 'AI Tutor Designer'),
    ('Migration errors could corrupt identity split', 'Full migration test suite before each push.', 5, 2, 'The Engineer'),
    ('Missing enrollment gates could allow open course access', 'Enrollment RLS must be tested for every role.', 4, 3, 'Security Officer')
) as seed(title, mitigation, severity, probability, owner)
where not exists (select 1 from public.hq_risks limit 1);

insert into public.hq_tasks (title, status, owner, priority, source)
select *
from (
  values
    ('Write RLS tests for enrollments', 'backlog', 'The Tester', 'P0', 'manual'),
    ('Draft ADR-001: Canvas Block Model', 'in_progress', 'The Architect', 'P1', 'manual'),
    ('Build course builder UI', 'done', 'The Implementer', 'P0', 'manual'),
    ('Implement gradebook schema', 'backlog', 'The Engineer', 'P1', 'manual'),
    ('Design AI tutor memory architecture', 'backlog', 'AI Tutor Designer', 'P2', 'manual'),
    ('Create Playwright E2E test suite', 'backlog', 'The Tester', 'P1', 'manual'),
    ('Set up GitHub Actions CI pipeline', 'backlog', 'DevOps Officer', 'P1', 'manual')
) as seed(title, status, owner, priority, source)
where not exists (select 1 from public.hq_tasks limit 1);
