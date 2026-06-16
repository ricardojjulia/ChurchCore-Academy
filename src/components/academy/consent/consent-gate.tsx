import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import type { ConsentState } from "@/lib/ui/theme";
import { cn } from "@/lib/utils";
import { ConsentStatusIndicator } from "@/components/academy/consent/consent-status-indicator";

export function ConsentGate({
  state,
  children,
  title = "Consent required",
  explanation = "This action stays disabled until the user has active consent on record.",
}: {
  state: ConsentState;
  children: ReactNode;
  title?: string;
  explanation?: string;
}) {
  const enabled = state === "active";

  return (
    <div
      aria-disabled={!enabled}
      data-consent-state={state}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-academy",
        !enabled && "opacity-85",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{explanation}</p>
        </div>
        <LockKeyhole className={cn("h-4 w-4 flex-none", enabled ? "text-emerald-600" : "text-rose-600")} />
      </div>
      <ConsentStatusIndicator state={state} />
      <div className={cn("mt-4", !enabled && "pointer-events-none select-none blur-[1px]")}>{children}</div>
    </div>
  );
}
