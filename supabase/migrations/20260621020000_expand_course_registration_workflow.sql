alter table public.academy_course_section_registrations
  drop constraint if exists academy_course_section_registrations_status_check;

alter table public.academy_course_section_registrations
  add constraint academy_course_section_registrations_status_check
  check (status in ('pending_confirmation', 'registered', 'waitlisted', 'withdrawn', 'completed'));

alter table public.academy_enrollment_confirmation_events
  drop constraint if exists academy_enrollment_confirmation_events_event_type_check;

alter table public.academy_enrollment_confirmation_events
  add constraint academy_enrollment_confirmation_events_event_type_check
  check (event_type in ('created', 'waitlisted', 'confirmed', 'withdrawn', 'override'));
