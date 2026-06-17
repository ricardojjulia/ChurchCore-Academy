-- Transcript issuances: registrar-issued academic transcripts per student
create table if not exists public.academy_transcript_issuances (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             text not null,
  student_person_id     uuid not null,
  status                text not null check (status in ('draft', 'issued', 'revoked'))
                          default 'issued',
  delivery_method       text not null check (delivery_method in ('digital_download', 'email', 'print')),
  recipient_name        text,
  recipient_email       text,
  note                  text,
  issued_at             timestamptz not null default now(),
  issued_by_person_id   uuid not null,
  revoked_at            timestamptz,
  revoked_by_person_id  uuid,
  idempotency_key       text not null,

  unique (tenant_id, idempotency_key)
);

-- Tenant isolation enforced via RLS
alter table public.academy_transcript_issuances enable row level security;
alter table public.academy_transcript_issuances force row level security;

create policy academy_transcript_issuances_tenant_isolation
  on public.academy_transcript_issuances
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Lookups by student (student PWA, admin view)
create index if not exists academy_transcript_issuances_student_idx
  on public.academy_transcript_issuances (tenant_id, student_person_id, issued_at desc);
