import { getDatabasePool } from "@/lib/database";
import { getStripeClient } from "@/lib/stripe";
import {
  PublicApplicationService,
  PublicApplicationNotFoundError,
} from "@/modules/admissions/public-application-service";
import { PostgresApplicationFeeRepository } from "@/modules/admissions/application-fee-repository";
import { ApplicationFeeCharge } from "@/modules/admissions/application-fee-types";
import { NextResponse } from "next/server";

function resolveTenantId(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("tenant");
  if (fromQuery) return fromQuery;
  const defaultTenant = process.env.ACADEMY_DEFAULT_TENANT_ID;
  if (defaultTenant) return defaultTenant;
  throw new Error("Unable to resolve institution. Tenant context is required.");
}

export type FeePayResponse =
  | { required: false; status?: ApplicationFeeCharge["status"] }
  | { required: true; checkoutUrl: string; amountCents: number; currency: string }
  | { required: true; checkoutUrl: null; message: string; amountCents: number; currency: string };

interface StripeCheckoutSessionResult {
  id: string;
  url: string | null;
}

interface PayFeeDependencies {
  resolveApplicationByToken(
    tenantId: string,
    statusToken: string,
  ): Promise<{ applicationId: string } | undefined>;
  findFeeCharge(
    tenantId: string,
    applicationId: string,
  ): Promise<ApplicationFeeCharge | undefined>;
  isStripeConfigured(): boolean;
  createCheckoutSession(input: {
    feeCharge: ApplicationFeeCharge;
    tenantId: string;
    applicationId: string;
    origin: string;
    statusToken: string;
  }): Promise<StripeCheckoutSessionResult>;
  storeCheckoutSession(
    tenantId: string,
    feeChargeId: string,
    stripeCheckoutSessionId: string,
  ): Promise<void>;
}

const defaultDependencies: PayFeeDependencies = {
  resolveApplicationByToken: async (tenantId, statusToken) => {
    const pool = getDatabasePool();
    return new PublicApplicationService(pool).resolveApplicationByToken(
      tenantId,
      statusToken,
    );
  },
  findFeeCharge: async (tenantId, applicationId) => {
    const pool = getDatabasePool();
    return new PostgresApplicationFeeRepository(pool).findByApplication(
      tenantId,
      applicationId,
      "application_fee",
    );
  },
  isStripeConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY),
  createCheckoutSession: async ({ feeCharge, tenantId, applicationId, origin, statusToken }) => {
    const stripe = getStripeClient(process.env.STRIPE_SECRET_KEY as string);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: feeCharge.currency.toLowerCase(),
            product_data: {
              name: "Application Fee",
              description: "Application fee for admission",
            },
            unit_amount: feeCharge.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        tenantId,
        applicationId,
        feeChargeId: feeCharge.id,
      },
      success_url: `${origin}/apply/status?token=${statusToken}&payment=success`,
      cancel_url: `${origin}/apply/status?token=${statusToken}&payment=cancelled`,
    });
    return { id: session.id, url: session.url };
  },
  storeCheckoutSession: async (tenantId, feeChargeId, stripeCheckoutSessionId) => {
    const pool = getDatabasePool();
    await new PostgresApplicationFeeRepository(pool).updateStripeCheckoutSession(
      tenantId,
      feeChargeId,
      stripeCheckoutSessionId,
    );
  },
};

export async function POST(request: Request) {
  return payApplicationFeeRequest(request, defaultDependencies);
}

export async function payApplicationFeeRequest(
  request: Request,
  dependencies: PayFeeDependencies = defaultDependencies,
) {
  try {
    const url = new URL(request.url);
    const statusToken = url.searchParams.get("token")?.trim();

    if (!statusToken) {
      return NextResponse.json(
        { error: "token query parameter is required." },
        { status: 400 },
      );
    }

    const tenantId = resolveTenantId(request);

    // Resolve application by token — this is the ONLY access control on this public,
    // unauthenticated route. There is no separate applicationId input anywhere below;
    // everything downstream is derived from the token, so a caller who only knows one
    // application's token has no way to reach another application's fee.
    const resolved = await dependencies.resolveApplicationByToken(
      tenantId,
      statusToken,
    );
    if (!resolved) {
      throw new PublicApplicationNotFoundError(
        "Application status token was not found.",
      );
    }

    const { applicationId } = resolved;

    const feeCharge = await dependencies.findFeeCharge(tenantId, applicationId);

    if (!feeCharge) {
      return NextResponse.json({ required: false });
    }

    if (feeCharge.status === "paid" || feeCharge.status === "waived") {
      return NextResponse.json({ required: false, status: feeCharge.status });
    }

    // Fee is pending — check if Stripe is configured
    if (!dependencies.isStripeConfigured()) {
      return NextResponse.json({
        required: true,
        checkoutUrl: null,
        message: "Please contact the admissions office to arrange payment.",
        amountCents: feeCharge.amountCents,
        currency: feeCharge.currency,
      });
    }

    const session = await dependencies.createCheckoutSession({
      feeCharge,
      tenantId,
      applicationId,
      origin: url.origin,
      statusToken,
    });

    await dependencies.storeCheckoutSession(tenantId, feeCharge.id, session.id);

    return NextResponse.json({
      required: true,
      checkoutUrl: session.url,
      amountCents: feeCharge.amountCents,
      currency: feeCharge.currency,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error.";

    if (error instanceof PublicApplicationNotFoundError) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (
      message.includes("not found") ||
      message.includes("was not found")
    ) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    console.error("[public/apply/fee/pay POST] Unexpected error:", message);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
