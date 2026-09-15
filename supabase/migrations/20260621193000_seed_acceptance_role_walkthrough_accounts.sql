create extension if not exists pgcrypto;

insert into public.academy_people (
  id,
  tenant_id,
  display_name,
  given_name,
  family_name,
  preferred_name,
  email,
  phone,
  date_of_birth,
  person_status,
  created_at,
  updated_at
)
values
  ('person-acceptance-admin', 'cca-main', 'Iris Admin', 'Iris', 'Admin', null, 'institution.admin@churchcore.academy', null, null, 'active', now(), now()),
  ('person-acceptance-registrar', 'cca-main', 'Ruth Registrar', 'Ruth', 'Registrar', null, 'registrar@churchcore.academy', null, null, 'active', now(), now()),
  ('person-acceptance-faculty', 'cca-main', 'Felix Faculty', 'Felix', 'Faculty', null, 'faculty@churchcore.academy', null, null, 'active', now(), now()),
  ('person-acceptance-finance', 'cca-main', 'Finley Finance', 'Finley', 'Finance', null, 'finance@churchcore.academy', null, null, 'active', now(), now()),
  ('person-acceptance-admissions', 'cca-main', 'Amara Admissions', 'Amara', 'Admissions', null, 'admissions@churchcore.academy', null, null, 'active', now(), now())
on conflict (id) do update
set display_name = excluded.display_name,
    email = excluded.email,
    person_status = 'active',
    updated_at = now();

insert into public.academy_staff_profiles (
  id,
  tenant_id,
  person_id,
  staff_number,
  title,
  primary_role,
  primary_subdivision_id,
  employment_status,
  load_policy,
  created_at,
  updated_at
)
values
  ('staff-acceptance-admin', 'cca-main', 'person-acceptance-admin', 'STAFF-ACCEPT-ADMIN', 'Institution Administrator', 'institution_admin', null, 'active', null, now(), now()),
  ('staff-acceptance-registrar', 'cca-main', 'person-acceptance-registrar', 'STAFF-ACCEPT-REG', 'Registrar', 'registrar', null, 'active', null, now(), now()),
  ('staff-acceptance-faculty', 'cca-main', 'person-acceptance-faculty', 'STAFF-ACCEPT-FAC', 'Faculty', 'faculty', null, 'active', null, now(), now()),
  ('staff-acceptance-finance', 'cca-main', 'person-acceptance-finance', 'STAFF-ACCEPT-FIN', 'Finance Officer', 'finance', null, 'active', null, now(), now()),
  ('staff-acceptance-admissions', 'cca-main', 'person-acceptance-admissions', 'STAFF-ACCEPT-ADM', 'Admissions Officer', 'admissions', null, 'active', null, now(), now())
on conflict (id) do update
set title = excluded.title,
    primary_role = excluded.primary_role,
    employment_status = 'active',
    updated_at = now();

with ranked_walkthrough_users as (
  select
    id,
    lower(email) as email,
    row_number() over (partition by lower(email) order by created_at asc, id asc) as row_number
  from auth.users
  where lower(email) in (
    'institution.admin@churchcore.academy',
    'registrar@churchcore.academy',
    'faculty@churchcore.academy',
    'guardian@churchcore.academy',
    'finance@churchcore.academy',
    'admissions@churchcore.academy'
  )
)
update auth.users auth_user
set email = 'duplicate-' || auth_user.id::text || '@churchcore.invalid',
    updated_at = now()
from ranked_walkthrough_users ranked
where ranked.id = auth_user.id
  and ranked.row_number > 1;

with persona(email, password, person_id, academy_role) as (
  values
    ('institution.admin@churchcore.academy', 'ChurchCore2026!', 'person-acceptance-admin', 'institution_admin'),
    ('registrar@churchcore.academy', 'ChurchCore2026!', 'person-acceptance-registrar', 'registrar'),
    ('faculty@churchcore.academy', 'ChurchCore2026!', 'person-acceptance-faculty', 'faculty'),
    ('guardian@churchcore.academy', 'ChurchCore2026!', 'person-marisol-rivera', 'guardian'),
    ('finance@churchcore.academy', 'ChurchCore2026!', 'person-acceptance-finance', 'finance'),
    ('admissions@churchcore.academy', 'ChurchCore2026!', 'person-acceptance-admissions', 'admissions')
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
    'institution.admin@churchcore.academy',
    'registrar@churchcore.academy',
    'faculty@churchcore.academy',
    'guardian@churchcore.academy',
    'finance@churchcore.academy',
    'admissions@churchcore.academy'
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
    ('institution.admin@churchcore.academy', 'person-acceptance-admin', 'institution_admin'),
    ('registrar@churchcore.academy', 'person-acceptance-registrar', 'registrar'),
    ('faculty@churchcore.academy', 'person-acceptance-faculty', 'faculty'),
    ('guardian@churchcore.academy', 'person-marisol-rivera', 'guardian'),
    ('finance@churchcore.academy', 'person-acceptance-finance', 'finance'),
    ('admissions@churchcore.academy', 'person-acceptance-admissions', 'admissions')
),
persona_users as (
  select distinct on (lower(auth_user.email))
    auth_user.id,
    lower(auth_user.email) as email
  from auth.users auth_user
  where lower(auth_user.email) in (
    'institution.admin@churchcore.academy',
    'registrar@churchcore.academy',
    'faculty@churchcore.academy',
    'guardian@churchcore.academy',
    'finance@churchcore.academy',
    'admissions@churchcore.academy'
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
  'account-walkthrough-' || split_part(persona.email, '@', 1),
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

with persona(email, person_id, academy_role, scope_type, scope_id) as (
  values
    ('institution.admin@churchcore.academy', 'person-acceptance-admin', 'institution_admin', 'tenant', null),
    ('registrar@churchcore.academy', 'person-acceptance-registrar', 'registrar', 'tenant', null),
    ('faculty@churchcore.academy', 'person-acceptance-faculty', 'faculty', 'tenant', null),
    ('guardian@churchcore.academy', 'person-marisol-rivera', 'guardian', 'student', 'person-lena-rivera'),
    ('finance@churchcore.academy', 'person-acceptance-finance', 'finance', 'tenant', null),
    ('admissions@churchcore.academy', 'person-acceptance-admissions', 'admissions', 'tenant', null)
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
    and assignment.scope_type = persona.scope_type
    and coalesce(assignment.scope_id, '') = coalesce(persona.scope_id, '')
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
  'role-walkthrough-' || split_part(persona.email, '@', 1),
  'cca-main',
  persona.person_id,
  persona.academy_role,
  persona.scope_type,
  persona.scope_id,
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
    and assignment.scope_type = persona.scope_type
    and coalesce(assignment.scope_id, '') = coalesce(persona.scope_id, '')
);
