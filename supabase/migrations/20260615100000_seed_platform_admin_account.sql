insert into public.academy_platform_role_assignments (
  external_subject,
  role,
  status,
  starts_on,
  ends_on,
  created_at,
  updated_at
)
select
  auth_user.id::text,
  'platform_admin',
  'active',
  current_date,
  null,
  now(),
  now()
from auth.users auth_user
where lower(auth_user.email) = 'admin@churchcore.academy'
on conflict (external_subject, role)
do update set
  status = 'active',
  starts_on = coalesce(public.academy_platform_role_assignments.starts_on, excluded.starts_on),
  ends_on = null,
  updated_at = now();
