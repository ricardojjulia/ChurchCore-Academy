create extension if not exists pgcrypto;

with ranked_demo_users as (
  select
    id,
    lower(email) as email,
    row_number() over (partition by lower(email) order by created_at asc, id asc) as row_number
  from auth.users
  where lower(email) in (
    'admin@churchcore.academy',
    'teacher@churchcore.academy',
    'student@churchcore.academy'
  )
)
update auth.users auth_user
set email = 'duplicate-' || auth_user.id::text || '@churchcore.invalid',
    updated_at = now()
from ranked_demo_users ranked
where ranked.id = auth_user.id
  and ranked.row_number > 1;

with persona(email, password, person_id, academy_role) as (
  values
    ('admin@churchcore.academy', 'ChurchCore2026!', 'person-regina-holt', 'institution_admin'),
    ('teacher@churchcore.academy', 'ChurchCore2026!', 'person-sophia-marsh', 'teacher'),
    ('student@churchcore.academy', 'ChurchCore2026!', 'person-lena-rivera', 'student')
),
updated_users as (
  update auth.users auth_user
  set encrypted_password = crypt(persona.password, gen_salt('bf')),
      email_confirmed_at = coalesce(auth_user.email_confirmed_at, now()),
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      reauthentication_token = '',
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      updated_at = now()
  from persona
  where lower(auth_user.email) = persona.email
  returning auth_user.id, lower(auth_user.email) as email
),
inserted_users as (
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    reauthentication_token,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    persona.email,
    crypt(persona.password, gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    '',
    '',
    '',
    '',
    '',
    now(),
    now()
  from persona
  where not exists (
    select 1
    from auth.users auth_user
    where lower(auth_user.email) = persona.email
  )
  returning id, email
),
all_persona_users as (
  select distinct on (lower(auth_user.email))
    auth_user.id,
    lower(auth_user.email) as email
  from auth.users auth_user
  where lower(auth_user.email) in (
    'admin@churchcore.academy',
    'teacher@churchcore.academy',
    'student@churchcore.academy'
  )
  order by lower(auth_user.email), auth_user.created_at asc, auth_user.id asc
),
repaired_identity_ids as (
  update auth.identities identity
  set id = gen_random_uuid(),
      updated_at = now()
  from all_persona_users persona_user
  where identity.user_id = persona_user.id
    and identity.provider = 'email'
    and identity.id = identity.user_id
  returning identity.id
)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  persona_user.id,
  persona_user.id::text,
  jsonb_build_object(
    'sub', persona_user.id::text,
    'email', persona_user.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from all_persona_users persona_user
on conflict (provider_id, provider) do update
set identity_data = excluded.identity_data,
    user_id = excluded.user_id,
    updated_at = now();

with persona(email, person_id, academy_role) as (
  values
    ('admin@churchcore.academy', 'person-regina-holt', 'institution_admin'),
    ('teacher@churchcore.academy', 'person-sophia-marsh', 'teacher'),
    ('student@churchcore.academy', 'person-lena-rivera', 'student')
),
persona_users as (
  select distinct on (lower(auth_user.email))
    auth_user.id,
    lower(auth_user.email) as email
  from auth.users auth_user
  where lower(auth_user.email) in (
    'admin@churchcore.academy',
    'teacher@churchcore.academy',
    'student@churchcore.academy'
  )
  order by lower(auth_user.email), auth_user.created_at asc, auth_user.id asc
)
insert into public.academy_account_links (
  id,
  tenant_id,
  person_id,
  provider,
  external_subject,
  status,
  created_at,
  updated_at
)
select
  'account-demo-' || split_part(persona.email, '@', 1),
  'cca-main',
  persona.person_id,
  'supabase',
  persona_user.id::text,
  'active',
  now(),
  now()
from persona
join persona_users persona_user
  on persona_user.email = persona.email
on conflict (id) do update
set person_id = excluded.person_id,
    provider = 'supabase',
    external_subject = excluded.external_subject,
    status = 'active',
    updated_at = now();

with persona(email) as (
  values
    ('admin@churchcore.academy'),
    ('teacher@churchcore.academy'),
    ('student@churchcore.academy')
),
persona_users as (
  select distinct on (lower(auth_user.email))
    auth_user.id,
    lower(auth_user.email) as email
  from auth.users auth_user
  where lower(auth_user.email) in (
    'admin@churchcore.academy',
    'teacher@churchcore.academy',
    'student@churchcore.academy'
  )
  order by lower(auth_user.email), auth_user.created_at asc, auth_user.id asc
)
update public.academy_account_links account
set status = 'inactive',
    updated_at = now()
from persona
join persona_users persona_user
  on persona_user.email = persona.email
where account.tenant_id = 'cca-main'
  and account.provider = 'supabase'
  and account.external_subject = persona_user.id::text
  and account.id <> 'account-demo-' || split_part(persona.email, '@', 1);

with persona(email, person_id, academy_role) as (
  values
    ('admin@churchcore.academy', 'person-regina-holt', 'institution_admin'),
    ('teacher@churchcore.academy', 'person-sophia-marsh', 'teacher'),
    ('student@churchcore.academy', 'person-lena-rivera', 'student')
),
updated_roles as (
  update public.academy_person_role_assignments assignment
  set status = 'active',
      starts_on = coalesce(assignment.starts_on, current_date),
      ends_on = null,
      updated_at = now()
  from persona
  where assignment.tenant_id = 'cca-main'
    and assignment.person_id = persona.person_id
    and assignment.role = persona.academy_role
    and assignment.scope_type = 'tenant'
    and coalesce(assignment.scope_id, '') = ''
  returning assignment.id
)
insert into public.academy_person_role_assignments (
  id,
  tenant_id,
  person_id,
  role,
  scope_type,
  scope_id,
  status,
  starts_on,
  ends_on,
  created_at,
  updated_at
)
select
  'role-demo-' || split_part(persona.email, '@', 1),
  'cca-main',
  persona.person_id,
  persona.academy_role,
  'tenant',
  null,
  'active',
  current_date,
  null,
  now(),
  now()
from persona
where not exists (
  select 1
  from public.academy_person_role_assignments assignment
  where assignment.tenant_id = 'cca-main'
    and assignment.person_id = persona.person_id
    and assignment.role = persona.academy_role
    and assignment.scope_type = 'tenant'
    and coalesce(assignment.scope_id, '') = ''
);

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
on conflict (external_subject, role) do update
set status = 'active',
    starts_on = coalesce(public.academy_platform_role_assignments.starts_on, excluded.starts_on),
    ends_on = null,
    updated_at = now();

insert into public.academy_platform_user_preferences (
  external_subject,
  active_tenant_id,
  created_at,
  updated_at
)
select
  auth_user.id::text,
  'cca-main',
  now(),
  now()
from auth.users auth_user
where lower(auth_user.email) = 'admin@churchcore.academy'
on conflict (external_subject) do update
set active_tenant_id = excluded.active_tenant_id,
    updated_at = now();

with demo_links as (
  select id, external_subject
  from public.academy_account_links
  where tenant_id = 'cca-main'
    and provider = 'supabase'
    and id in ('account-demo-admin', 'account-demo-teacher', 'account-demo-student')
)
update public.academy_account_links account
set status = 'inactive',
    updated_at = now()
from demo_links
where account.tenant_id = 'cca-main'
  and account.provider = 'supabase'
  and account.external_subject = demo_links.external_subject
  and account.id <> demo_links.id
  and account.status = 'active';
