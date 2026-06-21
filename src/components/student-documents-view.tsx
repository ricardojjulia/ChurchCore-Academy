"use client";

import { useState, useTransition } from "react";
import { FileCheck2, FileText, ShieldCheck } from "lucide-react";
import { StudentDashboardReadModel } from "@/modules/student-pwa/dashboard-read-model";

export function StudentDocumentsView({ model }: { model: StudentDashboardReadModel }) {
  const [requestStatus, setRequestStatus] = useState<"idle" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function requestTranscript() {
    setError(null);
    const idempotencyKey = crypto.randomUUID();

    startTransition(async () => {
      try {
        const response = await fetch("/api/academy/transcripts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            action: "request",
            deliveryMethod: "digital_download",
            note: "Student self-service transcript request.",
            idempotencyKey,
          }),
        });
        const payload = await response.json() as { error?: string };

        if (!response.ok) {
          setError(payload.error ?? "Transcript request failed.");
          return;
        }

        setRequestStatus("sent");
      } catch {
        setError("Transcript request failed.");
      }
    });
  }

  return (
    <section className="student-pwa-surface" aria-labelledby="student-documents-heading">
      <div className="student-pwa-surface-heading">
        <div>
          <p>Released records</p>
          <h2 id="student-documents-heading">{model.documents.length} available documents</h2>
        </div>
        <FileCheck2 />
      </div>

      <div className="student-pwa-safe-state">
        <FileText />
        <span>Need an official transcript? Submit a tenant-scoped request for registrar review.</span>
        <button
          type="button"
          className="student-pwa-action"
          onClick={requestTranscript}
          disabled={isPending || requestStatus === "sent"}
        >
          {isPending ? "Requesting..." : requestStatus === "sent" ? "Request sent" : "Request transcript"}
        </button>
      </div>

      {error && (
        <p className="student-pwa-alert" role="alert">
          {error}
        </p>
      )}

      <div className="student-pwa-surface-list">
        {model.documents.map((document) => (
          <article className="student-pwa-surface-row" key={document.id}>
            <span className="student-pwa-surface-icon">
              <FileText />
            </span>
            <div>
              <strong>{document.title}</strong>
              <span>{document.documentType}{document.updatedAt ? ` · Updated ${formatDocumentDate(document.updatedAt)}` : ""}</span>
            </div>
            <small>{document.statusLabel}</small>
          </article>
        ))}
      </div>

      <div className="student-pwa-safe-state">
        <ShieldCheck />
        <span>Only released Academy-owned document summaries are shown. Official transcript fulfillment remains registrar-controlled.</span>
      </div>
    </section>
  );
}

function formatDocumentDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
