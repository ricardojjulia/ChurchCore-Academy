import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { SensitivityBadge } from "@/components/academy/sensitivity-badge";
import type { SensitivityTier } from "@/lib/ui/theme";
import { cn } from "@/lib/utils";

export function SensitiveField({
  label,
  tier,
  helpText,
  children,
  className,
}: {
  label: string;
  tier: SensitivityTier;
  helpText?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        <SensitivityBadge tier={tier} />
      </div>
      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      <div>{children}</div>
    </div>
  );
}
