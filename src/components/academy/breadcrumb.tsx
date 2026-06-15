interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Breadcrumb Navigation following LMS UI spec section 7.7
 * 
 * Used inside pages, not as a global component:
 * <nav class="flex items-center gap-2 text-sm text-slate-400 mb-6">
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href ? (
            <a href={item.href} className="hover:text-primary font-medium">
              {item.label}
            </a>
          ) : (
            <span className="text-foreground font-semibold">{item.label}</span>
          )}
          {index < items.length - 1 && <span>/</span>}
        </div>
      ))}
    </nav>
  );
}

/**
 * Breadcrumb top bar variant for edit pages
 * Compact, at the top of the page
 */
export function BreadcrumbBar({ items }: BreadcrumbProps) {
  return (
    <div className="border-b border-border px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground bg-slate-50">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href ? (
            <a href={item.href} className="hover:text-primary">
              {item.label}
            </a>
          ) : (
            <span className="font-medium text-foreground truncate">{item.label}</span>
          )}
          {index < items.length - 1 && <span>/</span>}
        </div>
      ))}
    </div>
  );
}