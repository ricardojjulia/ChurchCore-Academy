"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { academyNotificationEvent, type AcademyNotification, type AcademyNotificationTone } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastRecord = Required<AcademyNotification>;

const toneStyles: Record<AcademyNotificationTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-red-200 bg-red-50 text-red-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-blue-200 bg-blue-50 text-blue-950",
};

const toneIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
} satisfies Record<AcademyNotificationTone, typeof Info>;

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  useEffect(() => {
    function onNotification(event: Event) {
      const toast = (event as CustomEvent<ToastRecord>).detail;
      setToasts((current) => [toast, ...current].slice(0, 4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 5200);
    }

    window.addEventListener(academyNotificationEvent, onNotification);
    return () => window.removeEventListener(academyNotificationEvent, onNotification);
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[80] grid w-[min(24rem,calc(100vw-2rem))] gap-3" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = toneIcons[toast.tone];

        return (
          <div key={toast.id} className={cn("flex gap-3 rounded-xl border p-4 shadow-lg", toneStyles[toast.tone])}>
            <Icon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <strong className="block text-sm font-semibold">{toast.title}</strong>
              {toast.message ? <p className="mt-1 text-sm opacity-85">{toast.message}</p> : null}
            </div>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Dismiss notification"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
