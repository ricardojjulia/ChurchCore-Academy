"use client";

import { useState, useTransition } from "react";
import { FileCheck2, FileText, ShieldCheck, Download } from "lucide-react";
import { StudentDashboardReadModel } from "@/modules/student-pwa/dashboard-read-model";

type DeliveryMethod = "digital_download" | "email" | "print";

interface FormState {
  deliveryMethod: DeliveryMethod;
  recipientName: string;
  recipientEmail: string;
  mailingAddress: string;
  note: string;
}

const defaultForm: FormState = {
  deliveryMethod: "digital_download",
  recipientName: "",
  recipientEmail: "",
  mailingAddress: "",
  note: "",
};

type RequestOutcome =
  | { type: "idle" }
  | { type: "success" }
  | { type: "billing_hold" }
  | { type: "duplicate"; existingId: string }
  | { type: "error"; message: string };

export function StudentDocumentsView({ model }: { model: StudentDashboardReadModel }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [outcome, setOutcome] = useState<RequestOutcome>({ type: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openForm() {
    setForm(defaultForm);
    setOutcome({ type: "idle" });
    setShowForm(true);
  }

  function submitRequest() {
    setOutcome({ type: "idle" });
    const idempotencyKey = crypto.randomUUID();

    startTransition(async () => {
      try {
        const response = await fetch("/api/academy/transcripts/request", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            action: "request",
            deliveryMethod: form.deliveryMethod,
            recipientName: form.recipientName || undefined,
            recipientEmail: form.recipientEmail || undefined,
            mailingAddress: form.mailingAddress || undefined,
            note: form.note || undefined,
            idempotencyKey,
          }),
        });

        const payload = (await response.json()) as {
          error?: string;
          message?: string;
          existingId?: string;
        };

        if (response.status === 422) {
          setOutcome({ type: "billing_hold" });
          return;
        }

        if (response.status === 409) {
          setOutcome({ type: "duplicate", existingId: payload.existingId ?? "" });
          return;
        }

        if (!response.ok) {
          setOutcome({ type: "error", message: payload.error ?? "Transcript request failed." });
          return;
        }

        setOutcome({ type: "success" });
        setShowForm(false);
      } catch {
        setOutcome({ type: "error", message: "Transcript request failed. Please try again." });
      }
    });
  }

  const needsEmail =
    form.deliveryMethod === "email" || form.deliveryMethod === "digital_download";
  const needsAddress = form.deliveryMethod === "print";

  return (
    <section className="student-pwa-surface" aria-labelledby="student-documents-heading">
      <div className="student-pwa-surface-heading">
        <div>
          <p>Released records</p>
          <h2 id="student-documents-heading">{model.documents.length} available documents</h2>
        </div>
        <FileCheck2 />
      </div>

      {/* Transcript request prompt / form */}
      {!showForm && outcome.type !== "success" && (
        <div className="student-pwa-safe-state">
          <FileText />
          <span>Need an official transcript? Submit a tenant-scoped request for registrar review.</span>
          <button
            type="button"
            className="student-pwa-action"
            onClick={openForm}
          >
            Request Official Transcript
          </button>
        </div>
      )}

      {outcome.type === "success" && (
        <div className="student-pwa-safe-state">
          <FileText />
          <span>Your request has been received. The registrar will review and fulfill it. You will be notified when your transcript is ready.</span>
          <button
            type="button"
            className="student-pwa-action"
            onClick={openForm}
          >
            Submit Another Request
          </button>
        </div>
      )}

      {/* Inline request form */}
      {showForm && (
        <div className="student-pwa-form" role="form" aria-label="Transcript request form">
          <div className="student-pwa-form-row">
            <label htmlFor="transcript-delivery" className="student-pwa-label">
              Delivery method
            </label>
            <select
              id="transcript-delivery"
              className="student-pwa-input"
              value={form.deliveryMethod}
              onChange={(e) => handleField("deliveryMethod", e.target.value as DeliveryMethod)}
              disabled={isPending}
            >
              <option value="digital_download">Digital download</option>
              <option value="email">Email to recipient</option>
              <option value="print">Print and mail</option>
            </select>
          </div>

          <div className="student-pwa-form-row">
            <label htmlFor="transcript-recipient-name" className="student-pwa-label">
              Recipient name <span aria-hidden="true">(optional)</span>
            </label>
            <input
              id="transcript-recipient-name"
              type="text"
              className="student-pwa-input"
              value={form.recipientName}
              onChange={(e) => handleField("recipientName", e.target.value)}
              placeholder="e.g. Graduate Admissions Office"
              disabled={isPending}
            />
          </div>

          {needsEmail && (
            <div className="student-pwa-form-row">
              <label htmlFor="transcript-recipient-email" className="student-pwa-label">
                Recipient email
              </label>
              <input
                id="transcript-recipient-email"
                type="email"
                className="student-pwa-input"
                value={form.recipientEmail}
                onChange={(e) => handleField("recipientEmail", e.target.value)}
                placeholder="admissions@university.edu"
                disabled={isPending}
              />
            </div>
          )}

          {needsAddress && (
            <div className="student-pwa-form-row">
              <label htmlFor="transcript-mailing-address" className="student-pwa-label">
                Mailing address
              </label>
              <textarea
                id="transcript-mailing-address"
                className="student-pwa-input"
                rows={3}
                value={form.mailingAddress}
                onChange={(e) => handleField("mailingAddress", e.target.value)}
                placeholder={"123 Main St\nCity, State ZIP"}
                disabled={isPending}
              />
            </div>
          )}

          <div className="student-pwa-form-row">
            <label htmlFor="transcript-note" className="student-pwa-label">
              Note <span aria-hidden="true">(optional)</span>
            </label>
            <input
              id="transcript-note"
              type="text"
              className="student-pwa-input"
              value={form.note}
              onChange={(e) => handleField("note", e.target.value)}
              placeholder="Any special instructions for the registrar"
              disabled={isPending}
            />
          </div>

          {/* Outcome alerts */}
          {outcome.type === "billing_hold" && (
            <p className="student-pwa-alert" role="alert">
              Your account has an outstanding balance. Please clear your balance before requesting a transcript.
            </p>
          )}
          {outcome.type === "duplicate" && (
            <p className="student-pwa-alert" role="alert">
              A request is already pending for this recipient. Please wait for the registrar to process it.
            </p>
          )}
          {outcome.type === "error" && (
            <p className="student-pwa-alert" role="alert">
              {outcome.message}
            </p>
          )}

          <div className="student-pwa-form-actions">
            <button
              type="button"
              className="student-pwa-action"
              onClick={submitRequest}
              disabled={isPending}
            >
              {isPending ? "Submitting..." : "Submit Request"}
            </button>
            <button
              type="button"
              className="student-pwa-action-secondary"
              onClick={() => { setShowForm(false); setOutcome({ type: "idle" }); }}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="student-pwa-surface-list">
        {model.documents.map((document) => (
          <article className="student-pwa-surface-row" key={document.id}>
            <span className="student-pwa-surface-icon">
              <FileText />
            </span>
            <div>
              <strong>{document.title}</strong>
              <span>
                {document.documentType}
                {document.updatedAt
                  ? ` · Updated ${formatDocumentDate(document.updatedAt)}`
                  : ""}
              </span>
            </div>
            <div className="student-pwa-surface-row-meta">
              <small>
                {document.statusLabel === "Released" || document.statusLabel === "released"
                  ? null
                  : document.statusLabel}
              </small>
              {(document.statusLabel === "Released" || document.statusLabel === "released") &&
              "downloadUrl" in document &&
              document.downloadUrl ? (
                <a
                  href={document.downloadUrl as string}
                  className="student-pwa-download-link"
                  download
                >
                  <Download size={12} />
                  Download
                </a>
              ) : (document.statusLabel === "Issued" || document.statusLabel === "issued" ||
                    document.statusLabel === "Held" || document.statusLabel === "held") ? (
                <small>Pending registrar review</small>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="student-pwa-safe-state">
        <ShieldCheck />
        <span>
          Only released Academy-owned document summaries are shown. Official transcript
          fulfillment remains registrar-controlled.
        </span>
      </div>
    </section>
  );
}

function formatDocumentDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
