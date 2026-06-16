import type { ReactNode } from "react";
import { PageHeader } from "@/components/academy/page-header";
import { Card } from "@/components/academy/card";
import { MobileEditorWarning } from "@/components/academy/mobile-editor-warning";

interface ListPageProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  children: ReactNode;
}

/**
 * List Page Template following LMS UI spec section 11
 * 
 * Layout:
 * - Page header (title + primary action)
 * - Optional filter/search row
 * - Table card (rounded-2xl, shadow-sm)
 * - Empty state card if no rows
 */
export function ListPageTemplate({
  title,
  subtitle,
  action,
  children,
}: ListPageProps) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </div>
  );
}

interface FormPageProps {
  breadcrumbs?: Array<{ label: string; href?: string }>;
  title: string;
  description?: string;
  children: ReactNode;
  showMobileWarning?: boolean;
}

/**
 * Detail / Edit Form Page Template following LMS UI spec section 11
 * 
 * Layout:
 * - Breadcrumb nav (optional)
 * - White card (rounded-2xl, p-8, shadow-sm)
 * - Section title and form fields
 * - Error / success banner (if any)
 * - Buttons row (submit + cancel, or destructive + cancel + save)
 */
export function FormPageTemplate({
  breadcrumbs,
  title,
  description,
  children,
  showMobileWarning = true,
}: FormPageProps) {
  return (
    <div>
      {showMobileWarning && <MobileEditorWarning />}
      {breadcrumbs && (
        <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          {breadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {item.href ? (
                <a href={item.href} className="hover:text-primary font-medium">
                  {item.label}
                </a>
              ) : (
                <span className="text-foreground font-semibold">{item.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <span>/</span>}
            </div>
          ))}
        </nav>
      )}

      <Card className="p-8">
        <div>
          <h1 className="text-xl font-extrabold text-foreground mb-1">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mb-6">{description}</p>
          )}
        </div>

        <div className="space-y-5">{children}</div>
      </Card>
    </div>
  );
}

interface DashboardPageProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Dashboard / Analytics Page Template following LMS UI spec section 11
 * 
 * Layout:
 * - Page header
 * - Summary cards row (grid-cols-2 sm:grid-cols-4, gap-4)
 * - Charts / tables section (space-y-6 or grid gap-6)
 * - Detail panels or reports
 */
export function DashboardPageTemplate({
  title,
  subtitle,
  children,
}: DashboardPageProps) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      {children}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string | number;
  subtext?: string;
}

/**
 * Summary Card for dashboard pages
 * 
 * white card, px-5 py-4
 * label: text-xs text-muted-foreground
 * value: text-2xl font-extrabold
 */
export function SummaryCard({ label, value, subtext }: SummaryCardProps) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-extrabold text-foreground mt-1">{value}</p>
      {subtext && (
        <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
      )}
    </Card>
  );
}
