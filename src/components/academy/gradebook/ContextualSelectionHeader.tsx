import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ContextualSelectionHeader({
  baseHref,
  studentId,
  studentName,
}: {
  baseHref: string;
  studentId?: string;
  studentName?: string;
}) {
  const activeLabel = studentId && studentName ? `${studentName}'s Gradebook` : "Gradebook";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Current context
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">Gradebook: {activeLabel}</h2>
      </div>
      {studentId ? (
        <Button
          variant="outline"
          render={<Link href={baseHref}>Clear Context ×</Link>}
          aria-label="Clear selected learner gradebook context"
        />
      ) : null}
    </div>
  );
}
