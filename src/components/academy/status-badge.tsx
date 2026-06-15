import type { ReactNode } from "react";

type BadgeStatus = "published" | "active" | "success" | "draft" | "pending" | "warning" | "archived" | "inactive" | "error" | "failed" | "processing" | "ai";

const badgeStyles: Record<BadgeStatus, string> = {
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
  error: "bg-rose-50 text-rose-600 border-rose-200",
  failed: "bg-rose-50 text-rose-600 border-rose-200",
  processing: "bg-violet-50 text-violet-700 border-violet-200",
  ai: "bg-violet-50 text-violet-700 border-violet-200",
};

interface StatusBadgeProps {
  status: BadgeStatus;
  children: ReactNode;
}

/**
 * Status Badge component following LMS UI spec section 7.3
 * 
 * All badges follow this structure — swap the color group per semantic meaning:
 * <span class="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
 *   Published
 * </span>
 */
export function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
        badgeStyles[status]
      }`}
    >
      {children}
    </span>
  );
}