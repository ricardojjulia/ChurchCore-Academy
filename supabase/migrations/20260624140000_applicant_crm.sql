-- Inquiry (pre-application lead)
create table if not exists public.academy_inquiries (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  program_of_interest text,
  source text check (source in ('website','referral','event','social_media','partner_church','other')),
  inquiry_date date not null default current_date,
  status text not null default 'new' check (status in ('new','contacted','nurturing','applied','enrolled','lost')),
  assigned_to_person_id text,
  notes text,
  converted_to_application_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.academy_inquiries enable row level security;
alter table public.academy_inquiries force row level security;

create policy "Tenant isolation for academy_inquiries"
  on public.academy_inquiries
  for all
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Drip sequence definition
create table if not exists public.academy_drip_sequences (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  name text not null,
  trigger_event text not null check (trigger_event in ('inquiry_received', 'application_started', 'application_submitted')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.academy_drip_sequences enable row level security;
alter table public.academy_drip_sequences force row level security;

create policy "Tenant isolation for academy_drip_sequences"
  on public.academy_drip_sequences
  for all
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Individual steps in a drip sequence
create table if not exists public.academy_drip_steps (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  sequence_id text not null references public.academy_drip_sequences(id) on delete cascade,
  step_number integer not null,
  delay_days integer not null default 0,
  template_key text not null,
  channel text not null default 'email',
  created_at timestamptz not null default now(),
  constraint academy_drip_steps_unique unique (sequence_id, step_number)
);

alter table public.academy_drip_steps enable row level security;
alter table public.academy_drip_steps force row level security;

create policy "Tenant isolation for academy_drip_steps"
  on public.academy_drip_steps
  for all
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Enrollment tracking (inquiry → application → enrolled)
create table if not exists public.academy_conversion_events (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  inquiry_id text references public.academy_inquiries(id),
  application_id text,
  event_type text not null check (event_type in ('inquiry_received','application_started','application_submitted','admitted','enrolled','declined','lost')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.academy_conversion_events enable row level security;
alter table public.academy_conversion_events force row level security;

create policy "Tenant isolation for academy_conversion_events"
  on public.academy_conversion_events
  for all
  using (tenant_id = current_setting('app.academy_tenant_id', true));
