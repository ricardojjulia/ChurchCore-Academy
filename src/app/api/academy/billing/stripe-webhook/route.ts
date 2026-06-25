import { NextRequest, NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/database";
import { getStripeClient } from "@/lib/stripe";
import { BillingService } from "@/modules/billing/service";
import {
  PostgresBillingRepository,
  type BillingDatabase,
} from "@/modules/billing/postgres-repository";
import type { AcademyActor } from "@/modules/academy-auth/policy";

export const dynamic = "force-dynamic";

/**
 * POST /api/academy/billing/stripe-webhook
 * Stripe webhook handler for checkout.session.completed events.
 * Validates webhook signature and posts payment to billing ledger.
 */
export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      return NextResponse.json(
        { error: "Stripe integration is not configured." },
        { status: 503 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header." },
        { status: 400 }
      );
    }

    const stripe = getStripeClient(stripeSecretKey);
    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 400 }
      );
    }

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as {
      id: string;
      metadata: { intentId?: string; tenantId?: string; studentPersonId?: string };
      amount_total: number | null;
    };

    const { intentId, tenantId, studentPersonId } = session.metadata;
    const amountTotal = session.amount_total;

    if (!intentId || !tenantId || !studentPersonId || !amountTotal) {
      return NextResponse.json(
        { error: "Missing required metadata in webhook event." },
        { status: 400 }
      );
    }

    const pool = getDatabasePool();
    const billingRepo = new PostgresBillingRepository({ query: pool.query.bind(pool) } as BillingDatabase);
    const billingService = new BillingService(billingRepo);

    const systemActor: AcademyActor = {
      userId: "system",
      tenantId,
      roles: ["institution_admin"],
    };

    const idempotencyKey = `stripe-session-${session.id}`;

    await billingService.postPayment(systemActor, {
      studentPersonId,
      amountCents: amountTotal,
      currency: "USD",
      provider: "stripe",
      providerReference: session.id,
      description: "Stripe Checkout payment",
      idempotencyKey,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
