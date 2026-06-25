import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Get or create a singleton Stripe client for the current secret key.
 * The secret key must be passed from the route layer (never resolved inside module functions).
 *
 * @param secretKey - Stripe secret key from process.env.STRIPE_SECRET_KEY
 * @returns Stripe client instance
 */
export function getStripeClient(secretKey: string): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(secretKey, {
      apiVersion: "2026-05-27.dahlia",
    });
  }
  return _stripe;
}
