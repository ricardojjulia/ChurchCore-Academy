import type { ReactNode } from "react";
import { Bot } from "lucide-react";
import { AIGeneratedBadge } from "@/components/academy/ai-generated-badge";
import { ConsentStatusIndicator } from "@/components/academy/consent/consent-status-indicator";
import type { ConsentState } from "@/lib/ui/theme";

export function AiTutorShell({
  consentState,
  title,
  children,
}: {
  consentState: ConsentState;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-label="AI Generated Content" className="rounded-2xl border border-border bg-card p-5 shadow-academy">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-academy-blue-50 p-2 text-academy-blue-700">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">AI content is always labeled and separated from human-authored material.</p>
          </div>
        </div>
        <AIGeneratedBadge />
      </header>
      <div className="mt-4">
        <ConsentStatusIndicator state={consentState} />
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-academy-blue-200 bg-academy-blue-50/60 p-4">{children}</div>
    </section>
  );
}
