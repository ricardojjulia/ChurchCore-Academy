import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import { getStripeClient } from "@/lib/stripe";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  BillingDatabase,
  PostgresBillingRepository,
} from "@/modules/billing/postgres-repository";
import { BillingService } from "@/modules/billing/service";
import type {
  BillingPaymentIntent,
  StudentAccountStatement,
} from "@/modules/billing/types";
import {
  buildStripeCheckoutSessionInput,
  type RecordCheckoutSessionInput,
  type StripeCheckoutSessionInput,
  type StripeCheckoutSessionResult,
} from "@/app/api/academy/billing/checkout/route";

export const dynamic = "force-dynamic";

interface StudentBillingCheckoutDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  readStatement?: (
    actor: AcademyActor,
    studentPersonId: string,
  ) => Promise<StudentAccountStatement>;
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
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function checkoutOrigin(request: Request) {
  return request.headers.get("origin") || "https://academy.churchcore.com";
}

async function defaultReadStatement(actor: AcademyActor, studentPersonId: string) {
  return withAcademyDatabaseContext(actor, async (client) => {
    const billingRepo = new PostgresBillingRepository(
      asAcademyDatabase<BillingDatabase>(client),
    );
    const billingService = new BillingService(billingRepo);
    return billingService.readStudentStatement(actor, studentPersonId);
  });
}

async function defaultCreatePaymentIntent(
  actor: AcademyActor,
  input: Parameters<NonNullable<StudentBillingCheckoutDependencies["createPaymentIntent"]>>[1],
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

export async function createStudentBillingCheckoutRequest(
  request: Request,
  dependencies: StudentBillingCheckoutDependencies = {},
) {
  try {
    const actor = await (dependencies.resolveActor ?? (() => requireActor()))(request);
    const readStatement = dependencies.readStatement ?? defaultReadStatement;
    const createPaymentIntent =
      dependencies.createPaymentIntent ?? defaultCreatePaymentIntent;
    const createCheckoutSession =
      dependencies.createCheckoutSession ?? defaultCreateCheckoutSession;

    const statement = await readStatement(actor, actor.userId);
    const amountCents = Math.max(statement.balanceCents, 0);

    if (amountCents <= 0) {
      return jsonError("No payment is currently due.", 400);
    }

    const intent = await createPaymentIntent(actor, {
      studentPersonId: actor.userId,
      amountCents,
      currency: statement.currency,
      provider: "stripe",
      idempotencyKey: `student-checkout-${randomUUID()}`,
    });

    const session = await createCheckoutSession(
      buildStripeCheckoutSessionInput({
        origin: checkoutOrigin(request),
        description: "Student account payment",
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

    return NextResponse.json({ checkoutUrl: session.url });
  } catch {
    return jsonError("Checkout session creation failed.", 500);
  }
}

export async function POST(request: NextRequest) {
  return createStudentBillingCheckoutRequest(request);
}
