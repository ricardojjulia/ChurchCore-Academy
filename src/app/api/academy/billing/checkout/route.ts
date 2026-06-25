import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { getStripeClient } from "@/lib/stripe";
import { BillingService } from "@/modules/billing/service";
import {
  PostgresBillingRepository,
  type BillingDatabase,
} from "@/modules/billing/postgres-repository";
import {
  PostgresCommunicationsRepository,
  type CommunicationsDatabase,
} from "@/modules/communications/postgres-repository";
import { CommunicationsService } from "@/modules/communications/service";

export const dynamic = "force-dynamic";

interface CheckoutRequestBody {
  studentPersonId: string;
  amountCents: number;
  description: string;
}

/**
 * POST /api/academy/billing/checkout
 * Creates a Stripe Checkout Session and sends payment link to student by email.
 * Admin roles only.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireActor();
    const body = (await request.json()) as CheckoutRequestBody;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe integration is not configured." },
        { status: 503 }
      );
    }

    const { studentPersonId, amountCents, description } = body;

    if (!studentPersonId || !amountCents || !description) {
      return NextResponse.json(
        { error: "studentPersonId, amountCents, and description are required." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: "amountCents must be a positive integer." },
        { status: 400 }
      );
    }

    const result = await withAcademyDatabaseContext(actor, async (client) => {
      const billingRepo = new PostgresBillingRepository(
        asAcademyDatabase<BillingDatabase>(client)
      );
      const billingService = new BillingService(billingRepo);

      const idempotencyKey = `checkout-${randomUUID()}`;
      const intent = await billingService.createPaymentIntent(actor, {
        studentPersonId,
        amountCents,
        currency: "USD",
        provider: "stripe",
        idempotencyKey,
      });

      const stripe = getStripeClient(stripeSecretKey);
      const origin = request.headers.get("origin") || "https://academy.churchcore.com";

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: description,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/student/account?payment=success`,
        cancel_url: `${origin}/student/account?payment=cancelled`,
        metadata: {
          intentId: intent.id,
          tenantId: actor.tenantId,
          studentPersonId,
        },
      });

      await billingRepo.updateCheckoutSession({
        tenantId: actor.tenantId,
        intentId: intent.id,
        stripeCheckoutSessionId: session.id,
        checkoutUrl: session.url ?? "",
      });

      const studentResult = (await client.query(
        `select display_name from academy_people
          where tenant_id = $1 and id = $2`,
        [actor.tenantId, studentPersonId]
      )) as { rows: Record<string, unknown>[] };
      const studentName =
        studentResult.rows[0]?.display_name != null
          ? String(studentResult.rows[0].display_name)
          : "Student";

      const commsRepo = new PostgresCommunicationsRepository(
        asAcademyDatabase<CommunicationsDatabase>(client)
      );
      const commsService = new CommunicationsService(commsRepo);

      await commsService.createCommunication(actor, {
        templateKey: "billing_account_update",
        audience: { type: "student", personId: studentPersonId },
        channels: ["in_app", "email"],
        variables: {
          studentName,
          summary: "Your payment link is ready",
          actionUrl: session.url ?? "",
        },
        sourceType: "billing",
        sourceId: intent.id,
        idempotencyKey: `checkout-email-${session.id}`,
        essential: true,
      });

      return {
        intentId: intent.id,
        checkoutUrl: session.url,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout session creation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
