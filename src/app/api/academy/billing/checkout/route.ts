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
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { BillingPaymentIntent } from "@/modules/billing/types";

export const dynamic = "force-dynamic";

export interface StripeCheckoutSessionInput {
  payment_method_types: ["card"];
  line_items: Array<{
    price_data: {
      currency: string;
      product_data: {
        name: string;
      };
      unit_amount: number;
    };
    quantity: number;
  }>;
  mode: "payment";
  success_url: string;
  cancel_url: string;
  metadata: {
    intentId: string;
    tenantId: string;
    studentPersonId: string;
  };
}

export interface StripeCheckoutSessionResult {
  id: string;
  url: string | null;
}

export interface RecordCheckoutSessionInput {
  tenantId: string;
  intentId: string;
  stripeCheckoutSessionId: string;
  checkoutUrl: string;
}

export interface EnqueuePaymentLinkInput {
  actor: AcademyActor;
  studentPersonId: string;
  checkoutUrl: string;
  intentId: string;
}

export interface BillingCheckoutDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  createPaymentIntent?: (
    actor: AcademyActor,
    input: {
      studentPersonId: string;
      amountCents: number;
      currency: string;
      provider: "stripe";
      idempotencyKey: string;
    },
  ) => Promise<BillingPaymentIntent>;
  createCheckoutSession?: (
    input: StripeCheckoutSessionInput,
  ) => Promise<StripeCheckoutSessionResult>;
  recordCheckoutSession?: (input: RecordCheckoutSessionInput) => Promise<void>;
  enqueuePaymentLink?: (input: EnqueuePaymentLinkInput) => Promise<void>;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function text(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function positiveAmount(value: unknown) {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error("amountCents must be a positive integer.");
  }
  return Number(value);
}

function checkoutOrigin(request: Request) {
  return request.headers.get("origin") || "https://academy.churchcore.com";
}

export function buildStripeCheckoutSessionInput(input: {
  origin: string;
  description: string;
  amountCents: number;
  intent: BillingPaymentIntent;
}): StripeCheckoutSessionInput {
  return {
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: input.intent.currency.toLowerCase(),
          product_data: {
            name: input.description,
          },
          unit_amount: input.amountCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${input.origin}/student/account?payment=success`,
    cancel_url: `${input.origin}/student/account?payment=cancelled`,
    metadata: {
      intentId: input.intent.id,
      tenantId: input.intent.tenantId,
      studentPersonId: input.intent.studentPersonId,
    },
  };
}

async function defaultCreatePaymentIntent(
  actor: AcademyActor,
  input: Parameters<NonNullable<BillingCheckoutDependencies["createPaymentIntent"]>>[1],
) {
  return withAcademyDatabaseContext(actor, async (client) => {
    const billingRepo = new PostgresBillingRepository(
      asAcademyDatabase<BillingDatabase>(client),
    );
    const billingService = new BillingService(billingRepo);
    return billingService.createPaymentIntent(actor, input);
  });
}

async function defaultCreateCheckoutSession(input: StripeCheckoutSessionInput) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("Stripe integration is not configured.");
  }
  const stripe = getStripeClient(stripeSecretKey);
  return stripe.checkout.sessions.create(input);
}

async function defaultRecordCheckoutSession(
  actor: AcademyActor,
  input: RecordCheckoutSessionInput,
) {
  await withAcademyDatabaseContext(actor, async (client) => {
    const billingRepo = new PostgresBillingRepository(
      asAcademyDatabase<BillingDatabase>(client),
    );
    await billingRepo.updateCheckoutSession(input);
  });
}

async function defaultEnqueuePaymentLink(input: EnqueuePaymentLinkInput) {
  await withAcademyDatabaseContext(input.actor, async (client) => {
    const studentResult = (await client.query(
      `select display_name from academy_people
        where tenant_id = $1 and id = $2`,
      [input.actor.tenantId, input.studentPersonId],
    )) as { rows: Record<string, unknown>[] };
    const studentName =
      studentResult.rows[0]?.display_name != null
        ? String(studentResult.rows[0].display_name)
        : "Student";

    const commsRepo = new PostgresCommunicationsRepository(
      asAcademyDatabase<CommunicationsDatabase>(client),
    );
    const commsService = new CommunicationsService(commsRepo);

    await commsService.createCommunication(input.actor, {
      templateKey: "billing_account_update",
      audience: { type: "student", personId: input.studentPersonId },
      channels: ["in_app", "email"],
      variables: {
        studentName,
        summary: "Your payment link is ready",
        actionUrl: input.checkoutUrl,
      },
      sourceType: "billing",
      sourceId: input.intentId,
      idempotencyKey: `checkout-email-${input.intentId}`,
      essential: true,
    });
  });
}

export async function createBillingCheckoutSessionRequest(
  request: Request,
  dependencies: BillingCheckoutDependencies = {},
) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Malformed JSON payload.", 400);
  }

  let studentPersonId: string;
  let amountCents: number;
  let description: string;
  try {
    studentPersonId = text(body.studentPersonId, "studentPersonId");
    amountCents = positiveAmount(body.amountCents);
    description = text(body.description, "description");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid checkout payload.";
    return jsonError(message, 400);
  }

  try {
    const actor = await (dependencies.resolveActor ?? (() => requireActor()))(request);
    const createPaymentIntent =
      dependencies.createPaymentIntent ?? defaultCreatePaymentIntent;
    const createCheckoutSession =
      dependencies.createCheckoutSession ?? defaultCreateCheckoutSession;
    const enqueuePaymentLink =
      dependencies.enqueuePaymentLink ?? defaultEnqueuePaymentLink;

    const intent = await createPaymentIntent(actor, {
      studentPersonId,
      amountCents,
      currency: "USD",
      provider: "stripe",
      idempotencyKey: `checkout-${randomUUID()}`,
    });

    const session = await createCheckoutSession(
      buildStripeCheckoutSessionInput({
        origin: checkoutOrigin(request),
        description,
        amountCents,
        intent,
      }),
    );

    if (!session.url) {
      return jsonError("Checkout session creation failed.", 502);
    }

    const recordInput = {
      tenantId: actor.tenantId,
      intentId: intent.id,
      stripeCheckoutSessionId: session.id,
      checkoutUrl: session.url,
    };
    if (dependencies.recordCheckoutSession) {
      await dependencies.recordCheckoutSession(recordInput);
    } else {
      await defaultRecordCheckoutSession(actor, recordInput);
    }

    await enqueuePaymentLink({
      actor,
      studentPersonId,
      checkoutUrl: session.url,
      intentId: intent.id,
    });

    return NextResponse.json({
      intentId: intent.id,
      checkoutUrl: session.url,
    });
  } catch {
    return jsonError("Checkout session creation failed.", 500);
  }
}

/**
 * POST /api/academy/billing/checkout
 * Creates a Stripe Checkout Session and sends payment link to student by email.
 * Admin roles only.
 */
export async function POST(request: NextRequest) {
  return createBillingCheckoutSessionRequest(request);
}
