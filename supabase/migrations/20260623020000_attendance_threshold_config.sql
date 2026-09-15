-- Attendance threshold configuration
-- Add config columns to academy_institution_profiles for attendance thresholds

alter table public.academy_institution_profiles
  add column if not exists attendance_warning_threshold_pct numeric(5,2) not null default 15.0,
  add column if not exists attendance_alert_threshold_pct numeric(5,2) not null default 25.0,
  add column if not exists attendance_excused_counts_toward_threshold boolean not null default false;

comment on column public.academy_institution_profiles.attendance_warning_threshold_pct is
  'Percentage of absences that triggers a warning-level ShepherdAI suggestion (default 15%)';

comment on column public.academy_institution_profiles.attendance_alert_threshold_pct is
  'Percentage of absences that triggers a high-urgency ShepherdAI suggestion and guardian notification (default 25%)';

comment on column public.academy_institution_profiles.attendance_excused_counts_toward_threshold is
  'Whether excused absences count toward threshold calculations (default false)';
