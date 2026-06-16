import { growthFrameFilter } from "@/lib/gradebook/growthFrameFilter";
import type { GradeDisplayInput } from "@/types/gradebook";

export function GrowthFramedGrade(props: GradeDisplayInput) {
  const display = growthFrameFilter(props);

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{display.assignmentTitle}</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{display.primaryLabel}</h3>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {display.displayPercentage}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{display.contextStatement}</p>
      {display.feedbackDisplay ? (
        <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-foreground">
          {display.feedbackDisplay}
        </p>
      ) : null}
    </article>
  );
}
