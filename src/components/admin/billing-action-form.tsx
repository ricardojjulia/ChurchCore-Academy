"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";

export interface BillingStudentOption {
  id: string;
  fullName: string;
  enrollmentStatus: string;
}

export function BillingActionForm({ students }: { students: BillingStudentOption[] }) {
  const [studentPersonId, setStudentPersonId] = useState("");
  const [action, setAction] = useState<"charge" | "credit" | "payment" | "payment_link">("charge");
  const [amount, setAmount] = useState("250.00");
  const [description, setDescription] = useState("Tuition charge");
  const [providerReference, setProviderReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const amountCents = Math.round(Number(amount) * 100);
    if (!studentPersonId) {
      setError("Please select a student.");
      return;
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (action === "payment" && providerReference.trim().length === 0) {
      setError("Manual payments require a receipt or reference.");
      return;
    }

    startTransition(async () => {
      try {
        const idempotencyKey = crypto.randomUUID();

        if (action === "payment_link") {
          const response = await fetch("/api/academy/billing/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentPersonId,
              amountCents,
              description,
            }),
          });
          const payload = await response.json() as { error?: string };

          if (!response.ok) {
            setError(payload.error ?? "Payment link generation failed.");
            return;
          }

          setMessage("Payment link sent to student by email.");
          return;
        }

        const response = await fetch("/api/academy/billing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            action,
            studentPersonId,
            amountCents,
            currency: "USD",
            description,
            provider: action === "payment" ? "manual" : undefined,
            providerReference: action === "payment" ? providerReference : undefined,
            idempotencyKey,
          }),
        });
        const payload = await response.json() as { error?: string };

        if (!response.ok) {
          setError(payload.error ?? "Billing action failed.");
          return;
        }

        setMessage("Student account updated. Refresh to see the posted ledger entry.");
        setProviderReference("");
      } catch {
        setError("Billing action failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="ops-form">
      <div className="ops-form-field">
        <label className="ops-form-label" htmlFor="billing-student">Student</label>
        <select
          id="billing-student"
          className="ops-form-select"
          value={studentPersonId}
          onChange={(event) => setStudentPersonId(event.target.value)}
          required
        >
          <option value="">Select a student</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.fullName} ({student.enrollmentStatus.replaceAll("_", " ")})
            </option>
          ))}
        </select>
      </div>

      <div className="ops-form-row">
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="billing-action">Action</label>
          <select
            id="billing-action"
            className="ops-form-select"
            value={action}
            onChange={(event) => setAction(event.target.value as "charge" | "credit" | "payment" | "payment_link")}
          >
            <option value="charge">Assess charge</option>
            <option value="credit">Apply credit</option>
            <option value="payment">Post manual payment</option>
            <option value="payment_link">Generate Stripe payment link</option>
          </select>
        </div>

        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="billing-amount">Amount</label>
          <input
            id="billing-amount"
            className="ops-form-input"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="ops-form-field">
        <label className="ops-form-label" htmlFor="billing-description">Description</label>
        <input
          id="billing-description"
          className="ops-form-input"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </div>

      {action === "payment" && (
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="billing-reference">Receipt / reference</label>
          <input
            id="billing-reference"
            className="ops-form-input"
            value={providerReference}
            onChange={(event) => setProviderReference(event.target.value)}
            placeholder="receipt-123"
            required
          />
        </div>
      )}

      {error && <p className="ops-form-error" role="alert">{error}</p>}
      {message && <p className="ops-form-success" role="status">{message}</p>}

      <button type="submit" className="ops-btn-primary" disabled={isPending}>
        {isPending
          ? action === "payment_link"
            ? "Generating link..."
            : "Posting..."
          : action === "payment_link"
            ? "Generate and send payment link"
            : "Post to account"}
      </button>

      {action === "payment_link" && (
        <p className="ops-metric-detail">
          <Link2 size={13} /> Stripe-hosted checkout link will be emailed to the student.
        </p>
      )}
    </form>
  );
}
