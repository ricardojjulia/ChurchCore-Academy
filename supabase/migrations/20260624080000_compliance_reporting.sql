-- Compliance reporting: IPEDS/ATS certified report generation
-- T4-02

create table if not exists academy_compliance_reports (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null,
  report_type              text not null check (
    report_type in (
      'ipeds_annual',
      'ats_annual',
      'title_iv_enrollment',
      'gainful_employment',
      'state_authorization',
      'custom'
    )
  ),
  reporting_year           text not null,
  status                   text not null default 'draft' check (
    status in ('draft', 'review', 'submitted', 'accepted', 'rejected')
  ),
  generated_by_person_id   uuid not null,
  submitted_at             timestamptz,
  submission_reference     text,
  data_snapshot            jsonb not null default '{}',
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_compliance_reports_tenant
  on academy_compliance_reports (tenant_id);
create index if not exists idx_compliance_reports_type_year
  on academy_compliance_reports (tenant_id, report_type, reporting_year);

alter table academy_compliance_reports enable row level security;
alter table academy_compliance_reports force row level security;

create policy compliance_reports_tenant_isolation
  on academy_compliance_reports
  using (tenant_id = current_setting('app.academy_tenant_id', true)::uuid);
