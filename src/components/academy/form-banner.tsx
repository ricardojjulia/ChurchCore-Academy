import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormBannerProps {
  type: "error" | "success";
  children: ReactNode;
  className?: string;
}

/**
 * Form-level error or success banner following LMS UI spec section 7.6
 * 
 * Error banner:
 * bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-rose-800 text-sm
 *
 * Success banner:
 * bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-800 text-sm
 */
export function FormBanner({ type, children, className }: FormBannerProps) {
  const styles =
    type === "error"
      ? "bg-rose-50 border border-rose-200 text-rose-800"
      : "bg-emerald-50 border border-emerald-200 text-emerald-800";

  return (
    <div className={cn("rounded-xl px-4 py-3 text-sm", styles, className)}>
      {children}
    </div>
  );
}