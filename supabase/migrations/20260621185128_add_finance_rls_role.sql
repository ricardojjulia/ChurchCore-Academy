-- ADR-0038 Prompt 2 follow-up:
-- Finance is a first-class Academy role for student accounts, institutional
-- aid, and finance communications. This forward migration aligns RLS with the
-- TypeScript service policies added for the ADR-0038 role matrix.

-- Billing policies.
drop policy if exists academy_student_accounts_read on public.academy_student_accounts;
create policy academy_student_accounts_read
on public.academy_student_accounts
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
    )
  )
);

drop policy if exists academy_student_accounts_admin_write on public.academy_student_accounts;
create policy academy_student_accounts_admin_write
on public.academy_student_accounts
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
);

drop policy if exists academy_billing_ledger_entries_read on public.academy_billing_ledger_entries;
create policy academy_billing_ledger_entries_read
on public.academy_billing_ledger_entries
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
    )
  )
);

drop policy if exists academy_billing_ledger_entries_insert on public.academy_billing_ledger_entries;
create policy academy_billing_ledger_entries_insert
on public.academy_billing_ledger_entries
for insert
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
);

drop policy if exists academy_payment_intents_read on public.academy_payment_intents;
create policy academy_payment_intents_read
on public.academy_payment_intents
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
    )
  )
);

drop policy if exists academy_payment_intents_insert on public.academy_payment_intents;
create policy academy_payment_intents_insert
on public.academy_payment_intents
for insert
with check (
  student_person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
);

-- Financial aid policies.
drop policy if exists academy_aid_packages_read on public.academy_aid_packages;
create policy academy_aid_packages_read
on public.academy_aid_packages
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
    )
  )
);

drop policy if exists academy_aid_packages_admin_write on public.academy_aid_packages;
create policy academy_aid_packages_admin_write
on public.academy_aid_packages
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
);

drop policy if exists academy_aid_awards_read on public.academy_aid_awards;
create policy academy_aid_awards_read
on public.academy_aid_awards
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
    )
  )
);

drop policy if exists academy_aid_awards_admin_write on public.academy_aid_awards;
create policy academy_aid_awards_admin_write
on public.academy_aid_awards
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
);

drop policy if exists academy_aid_disbursements_read on public.academy_aid_disbursements;
create policy academy_aid_disbursements_read
on public.academy_aid_disbursements
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
    )
  )
);

drop policy if exists academy_aid_disbursements_admin_write on public.academy_aid_disbursements;
create policy academy_aid_disbursements_admin_write
on public.academy_aid_disbursements
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
);

drop policy if exists academy_aid_holds_read on public.academy_aid_holds;
create policy academy_aid_holds_read
on public.academy_aid_holds
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
    )
  )
);

drop policy if exists academy_aid_holds_admin_write on public.academy_aid_holds;
create policy academy_aid_holds_admin_write
on public.academy_aid_holds
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
  )
);

-- Communications policies. Finance can administer billing-account update
-- communications and read tenant communication evidence.
drop policy if exists academy_communication_messages_read on public.academy_communication_messages;
create policy academy_communication_messages_read
on public.academy_communication_messages
for select
using (
  recipient_person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions', 'finance']
  )
);

drop policy if exists academy_communication_messages_staff_write on public.academy_communication_messages;
create policy academy_communication_messages_staff_write
on public.academy_communication_messages
for insert
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions', 'finance']
  )
);

drop policy if exists academy_communication_messages_recipient_update on public.academy_communication_messages;
create policy academy_communication_messages_recipient_update
on public.academy_communication_messages
for update
using (
  recipient_person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions', 'finance']
  )
)
with check (
  recipient_person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions', 'finance']
  )
);

drop policy if exists academy_communication_preferences_read on public.academy_communication_preferences;
create policy academy_communication_preferences_read
on public.academy_communication_preferences
for select
using (
  person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions', 'finance']
  )
);

drop policy if exists academy_communication_preferences_write on public.academy_communication_preferences;
create policy academy_communication_preferences_write
on public.academy_communication_preferences
for all
using (
  person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions', 'finance']
  )
)
with check (
  person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions', 'finance']
  )
);

drop policy if exists academy_communication_audit_events_read on public.academy_communication_audit_events;
create policy academy_communication_audit_events_read
on public.academy_communication_audit_events
for select
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions', 'finance']
  )
  or exists (
    select 1
    from public.academy_communication_messages message
    where message.tenant_id = academy_communication_audit_events.tenant_id
      and message.id = academy_communication_audit_events.message_id
      and message.recipient_person_id = academy_private.academy_current_person_id()
  )
);

drop policy if exists academy_communication_audit_events_insert on public.academy_communication_audit_events;
create policy academy_communication_audit_events_insert
on public.academy_communication_audit_events
for insert
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions', 'finance']
  )
  or actor_person_id = academy_private.academy_current_person_id()
);
