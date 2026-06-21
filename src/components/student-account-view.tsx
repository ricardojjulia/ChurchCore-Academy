"use client";

import { useState, useTransition } from "react";
import { CreditCard, ReceiptText } from "lucide-react";
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const suggestedPayment = Math.max(statement.balanceCents, 0);

  function createPaymentIntent() {
    setMessage(null);
    setError(null);

    if (suggestedPayment <= 0) {
      setError("No payment is currently due.");
      return;
    }

    startTransition(async () => {
      try {
        const idempotencyKey = crypto.randomUUID();
        const response = await fetch("/api/academy/billing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            action: "payment_intent",
            amountCents: suggestedPayment,
            currency: statement.currency,
            provider: "manual",
            idempotencyKey,
          }),
        });
        const payload = await response.json() as { error?: string };

        if (!response.ok) {
          setError(payload.error ?? "Payment intent failed.");
          return;
        }

        setMessage("Payment intent created. Online processor handoff is not enabled in this slice.");
      } catch {
        setError("Payment intent failed.");
      }
    });
  }

  return (
    <>
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
          Create a safe payment intent for the current balance. This MVP does not
          collect card data or store payment credentials.
        </p>
        <button
          type="button"
          className="student-pwa-empty-link"
          onClick={createPaymentIntent}
          disabled={isPending || suggestedPayment <= 0}
        >
          {isPending ? "Creating..." : `Create payment intent for ${money(suggestedPayment, statement.currency)}`}
        </button>
        {message && <p className="ops-form-success" role="status">{message}</p>}
        {error && <p className="ops-form-error" role="alert">{error}</p>}
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
