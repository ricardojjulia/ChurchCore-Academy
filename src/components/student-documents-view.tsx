import { FileCheck2, FileText, ShieldCheck } from "lucide-react";
import { StudentDashboardReadModel } from "@/modules/student-pwa/dashboard-read-model";

export function StudentDocumentsView({ model }: { model: StudentDashboardReadModel }) {
  return (
    <section className="student-pwa-surface" aria-labelledby="student-documents-heading">
      <div className="student-pwa-surface-heading">
        <div>
          <p>Released records</p>
          <h2 id="student-documents-heading">{model.documents.length} available documents</h2>
        </div>
        <FileCheck2 />
      </div>

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
        <span>Only released Academy-owned document summaries are shown. Downloads and uploads are not enabled in this sprint.</span>
      </div>
    </section>
  );
}

function formatDocumentDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
