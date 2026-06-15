import { CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import type { ComponentType } from "react";
import { ConsentState } from "@/lib/ui/theme";
import { cn } from "@/lib/utils";

const stateCopy: Record<ConsentState, { label: string; detail: string; icon: ComponentType<{ className?: string }> }> = {
  active: { label: "Consent active", detail: "Memory writes enabled", icon: CheckCircle2 },
  inactive: { label: "Consent inactive", detail: "Memory writes disabled", icon: ShieldAlert },
  pending_review: { label: "Consent pending review", detail: "Awaiting approval", icon: Clock3 },
};

export function ConsentStatusIndicator({ state }: { state: ConsentState }) {
  const info = stateCopy[state];
  const Icon = info.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-academySoft",
        state === "active" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        state === "inactive" && "border-rose-200 bg-rose-50 text-rose-900",
        state === "pending_review" && "border-amber-200 bg-amber-50 text-amber-900",
      )}
      data-consent-state={state}
    >
      <Icon className="h-4 w-4 flex-none" />
      <div>
        <strong className="block text-sm font-semibold">{info.label}</strong>
        <span className="block text-xs opacity-80">{info.detail}</span>
      </div>
    </div>
  );
}
