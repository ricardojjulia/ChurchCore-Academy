import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AIGeneratedBadge() {
  return (
    <Badge
      variant="secondary"
      aria-label="AI Generated Content"
      className="inline-flex items-center gap-1.5 rounded-full border border-academy-gold-200 bg-academy-gold-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-academy-gold-800"
    >
      <Sparkles className="h-3.5 w-3.5" />
      AI Generated Content
    </Badge>
  );
}
