-- Allow Stripe Checkout session metadata to be attached to payment intents
-- without broadening payment-intent access beyond the student/admin boundary.

drop policy if exists academy_payment_intents_update on public.academy_payment_intents;
create policy academy_payment_intents_update
on public.academy_payment_intents
for update
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
    )
  )
)
with check (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance']
    )
  )
);
