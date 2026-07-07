-- ADR-0064: Academic Year + Period Context Picker persistence
-- This table stores each user's selected academic year and period context.
-- The context survives browser close and persists across devices.
-- No foreign key constraints — if a year or period is deleted, the context gracefully returns null.

create table if not exists public.academy_user_context (
  user_id                   text not null,
  tenant_id                 text not null,
  active_academic_year_id   text,
  active_academic_period_id text,
  updated_at                timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

-- RLS: each user sees only their own context row
alter table public.academy_user_context enable row level security;
alter table public.academy_user_context force row level security;

create policy "user_context_read_own"
  on public.academy_user_context for select
  using (user_id = auth.uid()::text);

create policy "user_context_write_own"
  on public.academy_user_context for all
  using (user_id = auth.uid()::text);
