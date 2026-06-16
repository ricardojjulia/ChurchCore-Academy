import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  divider?: boolean;
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

interface CardEmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
}

/**
 * Card component following LMS UI spec section 7.4
 * 
 * Standard card:
 * bg-white border border-border rounded-2xl shadow-sm
 */
export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-border rounded-2xl shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Card Header with internal border and bg-slate-50
 * Used when you need a header section within a card
 */
export function CardHeader({
  children,
  className,
  divider = true,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-4",
        divider && "border-b border-border bg-slate-50",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Card Body with standard padding
 */
export function CardBody({ children, className }: CardBodyProps) {
  return (
    <div className={cn("px-6 py-4", className)}>
      {children}
    </div>
  );
}

/**
 * Empty State card following LMS UI spec section 7.4
 * 
 * Centered, with large padding and action link
 */
export function CardEmptyState({
  title,
  description,
  action,
}: CardEmptyStateProps) {
  return (
    <Card className="p-12 text-center">
      <p className="text-muted-foreground font-medium">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
      {action && (
        <a
          href={action.href}
          className="mt-3 inline-block text-sm text-primary hover:underline font-medium"
        >
          {action.label} →
        </a>
      )}
    </Card>
  );
}