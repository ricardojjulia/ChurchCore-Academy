"use client";

import { useState, useTransition } from "react";
import { HandCoins, ReceiptText, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import type { StudentAidSummary, AidPackage } from "@/modules/financial-aid/types";

function money(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

type DecisionState = Record<string, "accepted" | "declined" | "pending" | null>;

export function StudentAidView({ summary }: { summary: StudentAidSummary }) {
  const [decisions, setDecisions] = useState<DecisionState>({});
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function showToast(type: "success" | "error", text: string) {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  }

  function submitDecision(pkg: AidPackage, decision: "accepted" | "declined") {
    setProcessingId(pkg.id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/academy/financial-aid/${pkg.id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        });
        const payload = await res.json() as { error?: string };

        if (!res.ok) {
          showToast("error", payload.error ?? `Could not ${decision} the award package.`);
        } else {
          setDecisions((prev) => ({ ...prev, [pkg.id]: decision }));
          showToast(
            "success",
            decision === "accepted"
              ? `Award package for ${pkg.aidYear} accepted.`
              : `Award package for ${pkg.aidYear} declined.`,
          );
        }
      } catch {
        showToast("error", "Something went wrong. Please try again.");
      } finally {
        setProcessingId(null);
      }
    });
  }

  function packageDecision(pkg: AidPackage): "accepted" | "declined" | null {
    if (decisions[pkg.id]) return decisions[pkg.id] as "accepted" | "declined";
    if (pkg.acceptedAt) return "accepted";
    if (pkg.declinedAt) return "declined";
    return null;
  }

  const offeredPackages = summary.packages.filter(
    (pkg) => pkg.status === "offered" && packageDecision(pkg) === null,
  );

  return (
    <>
      {toastMessage?.type === "success" && (
        <div className="student-pwa-notice" role="status">
          <CheckCircle2 size={16} />
          <p>{toastMessage.text}</p>
        </div>
      )}
      {toastMessage?.type === "error" && (
        <div className="student-pwa-notice-error" role="alert">
          <XCircle size={16} />
          <p>{toastMessage.text}</p>
        </div>
      )}

      <div className="student-pwa-stats">
        <div className="student-pwa-stat">
          <span className="student-pwa-stat-value">{money(summary.totalAcceptedCents, summary.currency)}</span>
          <span className="student-pwa-stat-label">Accepted aid</span>
        </div>
        <div className="student-pwa-stat">
          <span className="student-pwa-stat-value">{money(summary.totalPostedCents, summary.currency)}</span>
          <span className="student-pwa-stat-label">Posted to account</span>
        </div>
        <div className="student-pwa-stat">
          <span className="student-pwa-stat-value">{summary.activeHolds.length}</span>
          <span className="student-pwa-stat-label">Active holds</span>
        </div>
      </div>

      {offeredPackages.length > 0 && (
        <section className="student-pwa-panel" aria-labelledby="award-decision-heading">
          <div className="student-pwa-panel-heading">
            <div>
              <p>Action required</p>
              <h2 id="award-decision-heading">Review your aid offer</h2>
            </div>
            <HandCoins />
          </div>
          {offeredPackages.map((pkg) => {
            const pkgAwards = summary.awards.filter((a) => a.packageId === pkg.id);
            const totalCents = pkgAwards.reduce((sum, a) => sum + a.amountCents, 0);
            const isProcessing = isPending && processingId === pkg.id;
            return (
              <div key={pkg.id} className="student-pwa-form" aria-label={`Aid offer ${pkg.aidYear}`}>
                <p><strong>Aid year:</strong> {pkg.aidYear}</p>
                {totalCents > 0 && (
                  <p><strong>Total offered:</strong> {money(totalCents, summary.currency)}</p>
                )}
                {pkg.acceptanceDeadline && (
                  <p><strong>Deadline:</strong> {displayDate(pkg.acceptanceDeadline)}</p>
                )}
                <div className="student-pwa-form-actions">
                  <button
                    type="button"
                    className="student-pwa-action"
                    onClick={() => submitDecision(pkg, "accepted")}
                    disabled={isProcessing}
                    aria-busy={isProcessing ? "true" : undefined}
                  >
                    {isProcessing ? "Processing…" : "Accept Award"}
                  </button>
                  <button
                    type="button"
                    className="student-pwa-action-secondary"
                    onClick={() => submitDecision(pkg, "declined")}
                    disabled={isProcessing}
                  >
                    Decline Award
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {summary.packages.filter((pkg) => packageDecision(pkg) === "accepted").length > 0 && (
        <div className="student-pwa-notice" role="status">
          <CheckCircle2 size={16} />
          <p>Your aid offer has been accepted. Awards will be posted to your account per the disbursement schedule.</p>
        </div>
      )}

      <section className="student-pwa-panel">
        <div className="student-pwa-panel-heading">
          <div>
            <p>Institutional aid</p>
            <h2>Awards</h2>
          </div>
          <HandCoins />
        </div>

        {summary.awards.length === 0 ? (
          <div className="student-pwa-empty">
            <HandCoins />
            <p>No released aid awards are available yet.</p>
          </div>
        ) : (
          <div className="student-pwa-surface-list">
            {summary.awards.map((award) => (
              <article key={award.id} className="student-pwa-surface-row">
                <span className="student-pwa-surface-icon">
                  <HandCoins />
                </span>
                <div>
                  <strong>{award.description}</strong>
                  <span>{statusLabel(award.awardType)} · {statusLabel(award.status)}</span>
                </div>
                <small>{money(award.amountCents, award.currency)}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="student-pwa-panel">
        <div className="student-pwa-panel-heading">
          <div>
            <p>Student account</p>
            <h2>Disbursements</h2>
          </div>
          <ReceiptText />
        </div>

        {summary.disbursements.length === 0 ? (
          <div className="student-pwa-empty">
            <ReceiptText />
            <p>No aid disbursements have been scheduled yet.</p>
          </div>
        ) : (
          <div className="student-pwa-surface-list">
            {summary.disbursements.map((disbursement) => (
              <article key={disbursement.id} className="student-pwa-surface-row">
                <span className="student-pwa-surface-icon">
                  <ReceiptText />
                </span>
                <div>
                  <strong>{displayDate(disbursement.scheduledOn)}</strong>
                  <span>{statusLabel(disbursement.status)}</span>
                </div>
                <small>{money(disbursement.amountCents, disbursement.currency)}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="student-pwa-panel">
        <div className="student-pwa-panel-heading">
          <div>
            <p>Requirements</p>
            <h2>Aid holds</h2>
          </div>
          <ShieldAlert />
        </div>

        {summary.activeHolds.length === 0 ? (
          <div className="student-pwa-empty">
            <ShieldAlert />
            <p>No active financial aid holds are currently attached to your record.</p>
          </div>
        ) : (
          <div className="student-pwa-surface-list">
            {summary.activeHolds.map((hold) => (
              <article key={hold.id} className="student-pwa-surface-row">
                <span className="student-pwa-surface-icon">
                  <ShieldAlert />
                </span>
                <div>
                  <strong>{statusLabel(hold.holdType)}</strong>
                  <span>{hold.reason}</span>
                </div>
                <small>{displayDate(hold.createdAt)}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
