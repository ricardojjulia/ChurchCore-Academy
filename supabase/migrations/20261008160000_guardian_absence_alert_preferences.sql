-- Persist guardian absence-alert consent per guardian/student relationship.
-- One guardian may choose differently for each linked student, so this belongs on the
-- relationship rather than on academy_people or the student's own notification preferences.

alter table public.academy_student_relationships
  add column if not exists absence_alerts_enabled boolean not null default true;

comment on column public.academy_student_relationships.absence_alerts_enabled is
  'Whether this guardian relationship receives automated attendance absence alerts.';
