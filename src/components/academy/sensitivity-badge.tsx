import { Badge } from "@/components/ui/badge";
import type { SensitivityTier } from "@/lib/ui/theme";

const sensitivityCopy: Record<SensitivityTier, { label: string; tone: string }> = {
  standard: { label: "Standard", tone: "Normal" },
  elevated: { label: "Elevated", tone: "Staff review" },
  pastoral: { label: "Pastoral", tone: "Highest sensitivity" },
};

export function SensitivityBadge({ tier }: { tier: SensitivityTier }) {
  const info = sensitivityCopy[tier];

  return (
    <Badge
      variant="secondary"
      className="inline-flex items-center gap-2 rounded-full border border-academy-blue-200 bg-academy-blue-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-academy-blue-800"
    >
      <span>{info.label}</span>
      <span aria-hidden="true" className="text-academy-blue-400">
        •
      </span>
      <span className="font-medium text-academy-blue-600">{info.tone}</span>
    </Badge>
  );
}
