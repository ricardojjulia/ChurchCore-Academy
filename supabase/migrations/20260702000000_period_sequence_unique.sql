-- ADR-0067: Period sequence must be unique within (tenant, academic_year)
-- This constraint ensures that each academic year has a unique, non-conflicting sequence
-- for its periods, enabling deterministic ordering and period selection.

create unique index if not exists academy_periods_tenant_year_seq_unique_idx
  on academy_academic_periods (tenant_id, academic_year_id, sequence);
