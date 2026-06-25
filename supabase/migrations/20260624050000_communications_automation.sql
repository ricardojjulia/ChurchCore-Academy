-- Communications automation: scheduled delivery and triggered workflow sends
-- Migration: 20260624050000

-- Add send_at column to academy_communication_messages for scheduled delivery
alter table public.academy_communication_messages
  add column if not exists send_at timestamptz;

comment on column public.academy_communication_messages.send_at is
  'Scheduled send time. NULL means send immediately, non-NULL means deliver at or after this time.';

-- Create academy_communication_triggers table for automated event-driven communications
create table if not exists public.academy_communication_triggers (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  event_type text not null,
  template_key text not null,
  audience_type text not null check (audience_type in ('student', 'guardian', 'staff_role')),
  channels text[] not null default array['in_app']::text[],
  essential boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.academy_communication_triggers is
  'Maps domain events to communication templates for automated workflow sends.';

comment on column public.academy_communication_triggers.event_type is
  'Event type: registration_confirmed, grade_posted, attendance_threshold_crossed, aid_package_offered, transcript_requested, payment_due, etc.';

comment on column public.academy_communication_triggers.template_key is
  'Maps to CommunicationTemplateKey union type in the communications module.';

comment on column public.academy_communication_triggers.audience_type is
  'Recipient type: student, guardian, or staff_role.';

comment on column public.academy_communication_triggers.channels is
  'Communication channels for this trigger: in_app, email.';

comment on column public.academy_communication_triggers.essential is
  'If true, bypasses email opt-out preferences.';

comment on column public.academy_communication_triggers.active is
  'If false, trigger is disabled and will not fire.';

-- Enable RLS on the triggers table
alter table public.academy_communication_triggers enable row level security;
alter table public.academy_communication_triggers force row level security;

-- RLS policy for triggers table
create policy "Triggers are tenant-isolated"
  on public.academy_communication_triggers
  for all
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Create unique index on (tenant_id, event_type, template_key) for upsert pattern
create unique index if not exists academy_communication_triggers_tenant_event_template_idx
  on public.academy_communication_triggers(tenant_id, event_type, template_key);

-- Create index on tenant_id and event_type for fast lookups
create index if not exists academy_communication_triggers_tenant_event_idx
  on public.academy_communication_triggers(tenant_id, event_type)
  where active = true;
