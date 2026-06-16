import { Badge } from "@/components/ui/badge";

export interface GradebookOverrideAuditEntry {
  id: string;
  overriddenBy: string;
  overrideType: "assignment_grade" | "final_grade";
  reason: string;
  overrideAt: string;
}

export function OverrideAuditLog({ entries }: { entries: GradebookOverrideAuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No overrides have been recorded.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline">{entry.overrideType}</Badge>
            <time className="text-xs text-muted-foreground" dateTime={entry.overrideAt}>
              {new Date(entry.overrideAt).toLocaleString()}
            </time>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">{entry.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">Adjusted by {entry.overriddenBy}</p>
        </li>
      ))}
    </ol>
  );
}
