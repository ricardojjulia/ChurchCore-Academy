import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    href?: string;
    label: string;
    onClick?: () => void;
  };
  children?: ReactNode;
}

/**
 * Page Header component following LMS UI spec section 7.1
 * 
 * Every list/admin page opens with a header row containing the title + primary action:
 * - Title: text-2xl font-extrabold
 * - Subtitle: text-sm text-muted-foreground mt-1
 * - Primary action button in the top right
 */
export function PageHeader({
  title,
  subtitle,
  action,
  children,
}: PageHeaderProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {action && (
          action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm hover:bg-primary/90 transition-colors"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {action.label}
            </button>
          )
        )}
      </div>
      {children}
    </>
  );
}