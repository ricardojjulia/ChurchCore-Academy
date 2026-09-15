-- Add Stripe Checkout session columns to payment intents table
-- Supports Stripe-hosted Checkout flow (PCI SAQ-A)

alter table public.academy_payment_intents
  add column if not exists stripe_checkout_session_id text,
  add column if not exists checkout_url text,
  add column if not exists voided_at timestamptz;

-- Unique index on Stripe session ID to prevent duplicate processing
create unique index if not exists academy_payment_intents_stripe_session_idx
  on public.academy_payment_intents (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

comment on column public.academy_payment_intents.stripe_checkout_session_id is
  'Stripe Checkout Session ID for tracking webhook events';

comment on column public.academy_payment_intents.checkout_url is
  'Stripe-hosted payment page URL sent to student';

comment on column public.academy_payment_intents.voided_at is
  'Timestamp when payment intent was voided or cancelled';
