"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, ReceiptText, CheckCircle2, XCircle } from "lucide-react";
import type { StudentAccountStatement } from "@/modules/billing/types";

function money(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function postedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function StudentAccountView({ statement }: { statement: StudentAccountStatement }) {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const suggestedPayment = Math.max(statement.balanceCents, 0);

  const paymentStatus = searchParams.get("payment");
  const paymentSuccessMessage = paymentStatus === "success"
    ? "Payment successful! Your account will update shortly."
    : null;
  const paymentCancelMessage = paymentStatus === "cancelled"
    ? "Payment was cancelled. Your balance remains unchanged."
    : null;

  function startStripeCheckout() {
    setMessage(null);
    setError(null);

    if (suggestedPayment <= 0) {
      setError("No payment is currently due.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/academy/students/me/billing/pay", {
          method: "POST",
        });
        const payload = await response.json() as {
          checkoutUrl?: string;
          error?: string;
        };

        if (!response.ok) {
          setError(payload.error ?? "Checkout session creation failed.");
          return;
        }

        if (!payload.checkoutUrl) {
          setError("Checkout session creation failed.");
          return;
        }

        window.location.assign(payload.checkoutUrl);
      } catch {
        setError("Checkout session creation failed.");
      }
    });
  }

  return (
    <>
      {(message ?? paymentSuccessMessage) && (
        <div className="student-pwa-notice" role="status">
          <CheckCircle2 size={16} />
          <p>{message ?? paymentSuccessMessage}</p>
        </div>
      )}
      {(error ?? paymentCancelMessage) && (
        <div className="student-pwa-notice-error" role="alert">
          <XCircle size={16} />
          <p>{error ?? paymentCancelMessage}</p>
        </div>
      )}

      <div className="student-pwa-stats">
        <div className="student-pwa-stat">
          <span className="student-pwa-stat-value">{money(statement.balanceCents, statement.currency)}</span>
          <span className="student-pwa-stat-label">Current balance</span>
        </div>
        <div className="student-pwa-stat">
          <span className="student-pwa-stat-value">{statement.entries.length}</span>
          <span className="student-pwa-stat-label">Ledger entries</span>
        </div>
      </div>

      <section className="student-pwa-panel">
        <div className="student-pwa-panel-heading">
          <div>
            <p>Payments</p>
            <h2>Student account payment</h2>
          </div>
          <CreditCard />
        </div>
        <p>
          Pay the current balance through Stripe-hosted Checkout. Academy never
          collects card data or stores payment credentials.
        </p>
        <button
          type="button"
          className="student-pwa-empty-link"
          onClick={startStripeCheckout}
          disabled={isPending || suggestedPayment <= 0}
        >
          {isPending ? "Redirecting..." : `Pay ${money(suggestedPayment, statement.currency)}`}
        </button>
      </section>

      <section className="student-pwa-panel">
        <div className="student-pwa-panel-heading">
          <div>
            <p>Ledger</p>
            <h2>Charges, credits, and payments</h2>
          </div>
          <ReceiptText />
        </div>

        {statement.entries.length === 0 ? (
          <div className="student-pwa-empty">
            <ReceiptText />
            <p>No account activity has been posted yet.</p>
          </div>
        ) : (
          <div className="student-pwa-surface-list">
            {statement.entries.map((entry) => (
              <article key={entry.id} className="student-pwa-surface-row">
                <span className="student-pwa-surface-icon">
                  <ReceiptText />
                </span>
                <div>
                  <strong>{entry.description}</strong>
                  <span>{entry.entryType} · {postedDate(entry.postedAt)}</span>
                </div>
                <small>{money(entry.amountCents, entry.currency)}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
