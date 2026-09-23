-- Enrollment Agreement E-Signature
-- Standalone e-signature tracking for accepted admission applications.
-- Created automatically when an application is decided 'accepted'.
-- No staff waiver/override path — every accepted applicant must sign.

create table if not exists public.academy_enrollment_agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  application_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'signed')),
  agreement_text_hash text,
  signed_by_person_id uuid,
  signed_at timestamptz,
  redacted_ip_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_application
    foreign key (tenant_id, application_id)
    references public.academy_admission_applications (tenant_id, id)
    on delete cascade,

  constraint signature_metadata_required
    check (
      status != 'signed' OR (
        signed_by_person_id IS NOT NULL AND
        signed_at IS NOT NULL AND
        agreement_text_hash IS NOT NULL
      )
    ),

  unique (application_id)
);

-- Tenant isolation via RLS
alter table public.academy_enrollment_agreement_signatures enable row level security;
alter table public.academy_enrollment_agreement_signatures force row level security;

create policy academy_enrollment_agreement_signatures_tenant_isolation
  on public.academy_enrollment_agreement_signatures
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Indexes for lookups
create index if not exists academy_enrollment_agreement_signatures_application_idx
  on public.academy_enrollment_agreement_signatures (tenant_id, application_id);

create index if not exists academy_enrollment_agreement_signatures_status_idx
  on public.academy_enrollment_agreement_signatures (tenant_id, status);
