import Link from "next/link";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { InMemoryAcademicWorkflowRepository, WorkflowQueueItem } from "@/modules/academic-workflows/repository";
import { ShepherdAiSuggestion, WorkflowRecord } from "@/modules/shepherd-ai/types";

export function StatCard({
  label,
  value,
  tone = "default",
  detail,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "gold" | "alert";
  detail?: string;
}) {
  return (
    <article className={`panel stat-card tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {detail ? <p className="stat-detail">{detail}</p> : null}
    </article>
  );
}

export function WorkflowList({
  items,
  title,
  emptyMessage,
}: {
  items: (WorkflowQueueItem | ShepherdAiSuggestion)[];
  title: string;
  emptyMessage: string;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>

      {items.length === 0 ? <p className="muted-text">{emptyMessage}</p> : null}

      <div className="workflow-list">
        {items.map((item) => {
          const entityHref =
            item.entityType === "student"
              ? `/students/${item.entityId}`
              : item.entityType === "program"
                ? `/programs/${item.entityId}`
                : item.entityType === "faculty" || item.entityType === "section"
                  ? "/faculty"
                  : "/";

          return (
            <article key={item.id} className="workflow-card">
              <div className="workflow-card-top">
                <div className="pill-row">
                  <span className={`pill urgency-${item.urgency}`}>{item.urgency} urgency</span>
                  <span className="pill">{item.status}</span>
                  <span className="pill">{item.workflowCode}</span>
                </div>
                {"confidenceScore" in item && item.confidenceScore ? (
                  <span className="confidence">{item.confidenceScore}% confidence</span>
                ) : null}
              </div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div className="action-row">
                <Link className="action-link" href={entityHref}>
                  View context
                </Link>
                <span className="muted-inline">Suggested next step: Assign review</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function SuggestionDetail({ suggestion }: { suggestion: ShepherdAiSuggestion }) {
  return (
    <article className="workflow-card detail-card">
      <div className="workflow-card-top">
        <div className="pill-row">
          <span className={`pill urgency-${suggestion.urgency}`}>{suggestion.urgency} urgency</span>
          <span className="pill">{suggestion.workflowCode}</span>
        </div>
        <span className="confidence">{suggestion.confidenceScore}% confidence</span>
      </div>
      <h3>{suggestion.title}</h3>
      <p>{suggestion.summary}</p>
      <dl className="explanation-list">
        <div>
          <dt>Why this surfaced</dt>
          <dd>{suggestion.explanation.whyItSurfaced}</dd>
        </div>
        <div>
          <dt>What was detected</dt>
          <dd>{suggestion.explanation.whatDetected}</dd>
        </div>
        <div>
          <dt>Boundary note</dt>
          <dd>{suggestion.boundaryNote}</dd>
        </div>
      </dl>
      <div className="token-row">
        {suggestion.explanation.sourceSignalCategories.map((category) => (
          <span key={category} className="token">
            {category}
          </span>
        ))}
      </div>
      <div className="list-block">
        <strong>Suggested next steps</strong>
        <ul>
          {suggestion.suggestedActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </div>
      {suggestion.messageDraft ? (
        <div className="draft-box">
          <strong>Editable administrative draft</strong>
          <pre>{suggestion.messageDraft}</pre>
        </div>
      ) : null}
    </article>
  );
}

export function WorkflowRecordList({
  workflows,
  repository,
}: {
  workflows: WorkflowRecord[];
  repository: InMemoryAcademicWorkflowRepository;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Academic Workflows</h2>
      </div>
      <div className="workflow-list">
        {workflows.map((workflow) => {
          const source = repository.suggestions.find((suggestion) => suggestion.id === workflow.suggestionId);
          return (
            <article key={workflow.id} className="workflow-card">
              <div className="workflow-card-top">
                <div className="pill-row">
                  <span className="pill">{workflow.status}</span>
                  <span className="pill">{workflow.workflowCode}</span>
                </div>
                {workflow.assignedToUserId ? <span className="confidence">Assigned to {resolveUser(workflow.assignedToUserId)}</span> : null}
              </div>
              <h3>{source?.title ?? workflow.workflowCode}</h3>
              <p>{source?.summary ?? "Workflow promoted from ShepherdAI suggestion."}</p>
              <div className="action-row">
                <span className="muted-inline">Owner: {resolveUser(workflow.ownerUserId)}</span>
                {workflow.dueAt ? <span className="muted-inline">Due {formatDate(workflow.dueAt)}</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function resolveUser(userId: string) {
  return academyDataset.administrators.find((admin) => admin.id === userId)?.name ?? userId;
}
