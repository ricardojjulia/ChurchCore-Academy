import { HandCoins, ReceiptText, ShieldAlert } from "lucide-react";
import type { StudentAidSummary } from "@/modules/financial-aid/types";

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

export function StudentAidView({ summary }: { summary: StudentAidSummary }) {
  return (
    <>
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
