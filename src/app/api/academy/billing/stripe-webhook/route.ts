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

interface StripeCheckoutSessionEvent {
  type: string;
  data: {
    object: {
      id?: string;
      metadata?: {
        tenantId?: string;
        studentPersonId?: string;
      };
      amount_total?: number | null;
      currency?: string | null;
    };
  };
}

interface StripeWebhookDependencies {
  webhookSecret?: string;
  constructEvent?: (
    body: string,
    signature: string,
    webhookSecret: string,
  ) => StripeCheckoutSessionEvent;
  serviceForTenant?: (_tenantId: string) => Promise<Pick<BillingService, "postPayment">>;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function defaultServiceForTenant() {
  const pool = getDatabasePool();
  const billingRepo = new PostgresBillingRepository({
    query: pool.query.bind(pool),
  } as BillingDatabase);
  return Promise.resolve(new BillingService(billingRepo));
}

export async function handleStripeWebhookRequest(
  request: Request,
  dependencies: StripeWebhookDependencies = {},
) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = dependencies.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET;

  if ((!dependencies.constructEvent && !stripeSecretKey) || !webhookSecret) {
    return jsonError("Stripe integration is not configured.", 503);
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return jsonError("Missing stripe-signature header.", 400);
  }

  const constructEvent =
    dependencies.constructEvent ??
    ((rawBody: string, rawSignature: string, secret: string) => {
      const stripe = getStripeClient(stripeSecretKey as string);
      return stripe.webhooks.constructEvent(
        rawBody,
        rawSignature,
        secret,
      ) as StripeCheckoutSessionEvent;
    });

  let event: StripeCheckoutSessionEvent;
  try {
    event = constructEvent(body, signature, webhookSecret);
  } catch {
    return jsonError("Invalid webhook signature.", 400);
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const tenantId = session.metadata?.tenantId;
  const studentPersonId = session.metadata?.studentPersonId;
  const amountTotal = session.amount_total;

  if (!session.id || !tenantId || !studentPersonId || !amountTotal) {
    return jsonError("Missing required metadata in webhook event.", 400);
  }

  try {
    const service = await (
      dependencies.serviceForTenant ?? defaultServiceForTenant
    )(tenantId);
    const systemActor: AcademyActor = {
      userId: "system",
      tenantId,
      roles: ["institution_admin"],
    };

    await service.postPayment(systemActor, {
      studentPersonId,
      amountCents: amountTotal,
      currency: (session.currency ?? "usd").toUpperCase(),
      provider: "stripe",
      providerReference: session.id,
      description: "Stripe Checkout payment",
      idempotencyKey: `stripe-session-${session.id}`,
    });

    return NextResponse.json({ received: true });
  } catch {
    return jsonError("Webhook processing failed.", 500);
  }
}

/**
 * POST /api/academy/billing/stripe-webhook
 * Stripe webhook handler for checkout.session.completed events.
 * Validates webhook signature and posts payment to billing ledger.
 */
export async function POST(request: NextRequest) {
  return handleStripeWebhookRequest(request);
}
