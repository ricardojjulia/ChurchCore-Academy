import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicApplyStatusUrl,
  payApplicationFeeRequest,
} from "@/app/api/public/apply/fee/pay/route";
import { PublicInstitutionNotFoundError } from "@/app/api/public/apply/institution-resolver";
import { PublicApplicationNotFoundError } from "@/modules/admissions/public-application-service";
import { ApplicationFeeCharge } from "@/modules/admissions/application-fee-types";

function feeCharge(overrides: Partial<ApplicationFeeCharge> = {}): ApplicationFeeCharge {
  return {
    id: "fee-1",
    tenantId: "tenant-a",
    applicationId: "app-1",
    feeType: "application_fee",
    amountCents: 5000,
    currency: "USD",
    status: "pending",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function request(query: string) {
  return new Request(`http://localhost/api/public/apply/fee/pay${query}`, {
    method: "POST",
  });
}

const trustedInstitution = {
  resolveTenantId: async () => "tenant-a",
};

test("public fee/pay - 400 when token query param is missing", async () => {
  const response = await payApplicationFeeRequest(request(""), {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    findFeeCharge: async () => feeCharge(),
    isStripeConfigured: () => true,
    createCheckoutSession: async () => ({ id: "sess-1", url: "https://checkout.stripe.com/sess-1" }),
    storeCheckoutSession: async () => {},
  });
  assert.equal(response.status, 400);
});

test("public fee/pay - 404 for an unresolvable token, without exposing whether an application exists", async () => {
  const response = await payApplicationFeeRequest(request("?token=bad-token"), {
    ...trustedInstitution,
    resolveApplicationByToken: async () => undefined,
    findFeeCharge: async () => feeCharge(),
    isStripeConfigured: () => true,
    createCheckoutSession: async () => ({ id: "sess-1", url: "https://checkout.stripe.com/sess-1" }),
    storeCheckoutSession: async () => {},
  });
  assert.equal(response.status, 404);
  const body = (await response.json()) as { error: string };
  assert.doesNotMatch(body.error, /application-1|app-1/);
});

test("public fee/pay - no fee configured returns required: false without touching Stripe", async () => {
  let checkoutSessionCreated = false;
  const response = await payApplicationFeeRequest(request("?token=tok-1"), {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    findFeeCharge: async () => undefined,
    isStripeConfigured: () => true,
    createCheckoutSession: async () => {
      checkoutSessionCreated = true;
      return { id: "sess-1", url: "https://checkout.stripe.com/sess-1" };
    },
    storeCheckoutSession: async () => {},
  });
  const body = (await response.json()) as { required: boolean };
  assert.equal(response.status, 200);
  assert.equal(body.required, false);
  assert.equal(checkoutSessionCreated, false);
});

test("public fee/pay - already-paid fee is idempotent, returns status without creating a new checkout session", async () => {
  let checkoutSessionCreated = false;
  const response = await payApplicationFeeRequest(request("?token=tok-1"), {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    findFeeCharge: async () => feeCharge({ status: "paid" }),
    isStripeConfigured: () => true,
    createCheckoutSession: async () => {
      checkoutSessionCreated = true;
      return { id: "sess-1", url: "https://checkout.stripe.com/sess-1" };
    },
    storeCheckoutSession: async () => {},
  });
  const body = (await response.json()) as { required: boolean; status?: string };
  assert.equal(response.status, 200);
  assert.equal(body.required, false);
  assert.equal(body.status, "paid");
  assert.equal(checkoutSessionCreated, false);
});

test("public fee/pay - already-waived fee is idempotent", async () => {
  const response = await payApplicationFeeRequest(request("?token=tok-1"), {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    findFeeCharge: async () => feeCharge({ status: "waived" }),
    isStripeConfigured: () => true,
    createCheckoutSession: async () => ({ id: "sess-1", url: "https://checkout.stripe.com/sess-1" }),
    storeCheckoutSession: async () => {},
  });
  const body = (await response.json()) as { required: boolean; status?: string };
  assert.equal(body.required, false);
  assert.equal(body.status, "waived");
});

test("public fee/pay - pending fee with no Stripe configured returns the friendly fallback message, not a checkout URL", async () => {
  const response = await payApplicationFeeRequest(request("?token=tok-1"), {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    findFeeCharge: async () => feeCharge(),
    isStripeConfigured: () => false,
    createCheckoutSession: async () => ({ id: "sess-1", url: "https://checkout.stripe.com/sess-1" }),
    storeCheckoutSession: async () => {},
  });
  const body = (await response.json()) as {
    required: boolean;
    checkoutUrl: string | null;
    message: string;
  };
  assert.equal(response.status, 200);
  assert.equal(body.required, true);
  assert.equal(body.checkoutUrl, null);
  assert.match(body.message, /contact/i);
});

test("public fee/pay - pending fee with Stripe configured creates a checkout session scoped to the token-resolved application", async () => {
  let sessionInput:
    | { applicationId: string; tenantId: string; trustedInstitutionQuery: string }
    | undefined;
  let storedSessionId: string | undefined;

  const response = await payApplicationFeeRequest(
    request("?token=tok-1&institution=ChurchCore-Academy&tenant=attacker"),
    {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    findFeeCharge: async () => feeCharge(),
    isStripeConfigured: () => true,
    createCheckoutSession: async ({ applicationId, tenantId, trustedInstitutionQuery }) => {
      sessionInput = { applicationId, tenantId, trustedInstitutionQuery };
      return { id: "sess-1", url: "https://checkout.stripe.com/sess-1" };
    },
    storeCheckoutSession: async (_tenantId, _feeChargeId, stripeCheckoutSessionId) => {
      storedSessionId = stripeCheckoutSessionId;
    },
    },
  );

  const body = (await response.json()) as { required: boolean; checkoutUrl: string };
  assert.equal(response.status, 200);
  assert.equal(body.required, true);
  assert.equal(body.checkoutUrl, "https://checkout.stripe.com/sess-1");
  // The checkout session must be scoped to the application the TOKEN resolved to —
  // there is no other applicationId input on this route, so this is the whole of the
  // cross-applicant isolation guarantee on this endpoint.
  assert.deepEqual(sessionInput, {
    applicationId: "app-1",
    tenantId: "tenant-a",
    trustedInstitutionQuery: "institution=ChurchCore-Academy",
  });
  assert.equal(storedSessionId, "sess-1");
});

test("public fee/pay - institution miss fails closed before downstream application or fee lookup", async () => {
  let downstreamTouched = false;
  const response = await payApplicationFeeRequest(request("?token=tok-1"), {
    resolveTenantId: async () => {
      throw new PublicInstitutionNotFoundError();
    },
    resolveApplicationByToken: async () => {
      downstreamTouched = true;
      return { applicationId: "app-1" };
    },
    findFeeCharge: async () => {
      downstreamTouched = true;
      return feeCharge();
    },
    isStripeConfigured: () => true,
    createCheckoutSession: async () => {
      downstreamTouched = true;
      return { id: "sess-1", url: "https://checkout.stripe.com/sess-1" };
    },
    storeCheckoutSession: async () => {
      downstreamTouched = true;
    },
  });

  assert.equal(response.status, 404);
  assert.equal(downstreamTouched, false);
});

test("buildPublicApplyStatusUrl preserves trusted institution slug and never adds tenant", () => {
  const url = buildPublicApplyStatusUrl(
    "https://academy.example",
    "tok 1",
    "success",
    "institution=churchcore-academy",
  );

  assert.equal(
    url,
    "https://academy.example/apply/status?institution=churchcore-academy&token=tok+1&payment=success",
  );
  assert.doesNotMatch(url, /tenant=/);
});

test("public fee/pay - cross-applicant isolation: two different tokens can only ever resolve to their own application, never each other's", async () => {
  const tokenToApplication: Record<string, string> = {
    "token-for-app-1": "app-1",
    "token-for-app-2": "app-2",
  };
  const feeChargesByApplication: Record<string, ApplicationFeeCharge> = {
    "app-1": feeCharge({ applicationId: "app-1", id: "fee-1" }),
    "app-2": feeCharge({ applicationId: "app-2", id: "fee-2", amountCents: 9900 }),
  };

  const dependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async (_tenantId: string, statusToken: string) => {
      const applicationId = tokenToApplication[statusToken];
      return applicationId ? { applicationId } : undefined;
    },
    findFeeCharge: async (_tenantId: string, applicationId: string) =>
      feeChargesByApplication[applicationId],
    isStripeConfigured: () => false,
    createCheckoutSession: async () => ({ id: "sess-1", url: null }),
    storeCheckoutSession: async () => {},
  };

  const responseForApp1 = await payApplicationFeeRequest(
    request("?token=token-for-app-1"),
    dependencies,
  );
  const responseForApp2 = await payApplicationFeeRequest(
    request("?token=token-for-app-2"),
    dependencies,
  );

  const bodyForApp1 = (await responseForApp1.json()) as { amountCents: number };
  const bodyForApp2 = (await responseForApp2.json()) as { amountCents: number };

  assert.equal(bodyForApp1.amountCents, 5000);
  assert.equal(bodyForApp2.amountCents, 9900);
});

test("public fee/pay - PublicApplicationNotFoundError maps to 404", async () => {
  const response = await payApplicationFeeRequest(request("?token=tok-1"), {
    ...trustedInstitution,
    resolveApplicationByToken: async () => {
      throw new PublicApplicationNotFoundError("Application status token was not found.");
    },
    findFeeCharge: async () => feeCharge(),
    isStripeConfigured: () => true,
    createCheckoutSession: async () => ({ id: "sess-1", url: "https://checkout.stripe.com/sess-1" }),
    storeCheckoutSession: async () => {},
  });
  assert.equal(response.status, 404);
});
