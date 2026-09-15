-- Add storage_url column to academy_transcript_issuances for PDF file paths
alter table public.academy_transcript_issuances
  add column if not exists storage_url text;

-- Index for lookup by storage URL (for maintenance/cleanup jobs)
create index if not exists academy_transcript_issuances_storage_url_idx
  on public.academy_transcript_issuances (tenant_id, storage_url)
  where storage_url is not null;
