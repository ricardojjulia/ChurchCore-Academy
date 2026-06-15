import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TableProps {
  children: ReactNode;
  className?: string;
}

interface TableHeadProps {
  children: ReactNode;
  className?: string;
}

interface TableBodyProps {
  children: ReactNode;
  className?: string;
}

interface TableRowProps {
  children: ReactNode;
  className?: string;
  header?: boolean;
}

interface TableCellProps {
  children: ReactNode;
  className?: string;
  header?: boolean;
  align?: "left" | "center" | "right";
}

/**
 * Table component following LMS UI spec section 7.5
 * 
 * Always wrapped in a rounded-2xl overflow-hidden card — never a bare <table>.
 */
export function Table({ children, className }: TableProps) {
  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
      <table className={cn("w-full text-sm", className)}>
        {children}
      </table>
    </div>
  );
}

/**
 * Table Head with bg-slate-50 and border-b
 */
export function TableHead({ children, className }: TableHeadProps) {
  return (
    <thead className={cn("bg-slate-50 border-b border-border", className)}>
      {children}
    </thead>
  );
}

/**
 * Table Body with divide-y borders
 */
export function TableBody({ children, className }: TableBodyProps) {
  return (
    <tbody className={cn("divide-y divide-border", className)}>
      {children}
    </tbody>
  );
}

/**
 * Table Row with hover:bg-slate-50 transition
 */
export function TableRow({ children, className, header }: TableRowProps) {
  return (
    <tr
      className={cn(
        !header && "hover:bg-slate-50 transition-colors",
        className
      )}
    >
      {children}
    </tr>
  );
}

/**
 * Table Cell following spec pattern:
 * - Primary label: font-semibold text-foreground
 * - Secondary metadata below it: text-xs text-muted-foreground
 * - Code / identifier: text-xs text-muted-foreground font-mono
 * - Actions column: right-aligned, text-sm font-semibold text-primary hover:underline
 */
export function TableCell({
  children,
  className,
  header,
  align = "left",
}: TableCellProps) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  if (header) {
    return (
      <th className={cn("px-6 py-3 font-semibold text-muted-foreground", alignClass, className)}>
        {children}
      </th>
    );
  }

  return (
    <td className={cn("px-6 py-4 text-foreground", alignClass, className)}>
      {children}
    </td>
  );
}