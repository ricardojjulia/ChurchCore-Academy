import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | "success" | "warning" | "info";

// Nocturne tags: tonal ramp fills (accent-800/accent-100, neutral-800/
// neutral-100), never the raw accent as a flood. Functional status colors
// (success/warning/destructive) use Tailwind's own dark-friendly steps
// since they're outside Nocturne's mono accent+neutral scheme.
const variantMap: Record<BadgeVariant, string> = {
  default: "border-transparent bg-[var(--color-accent-800)] text-[var(--color-accent-100)]",
  secondary: "border-transparent bg-[var(--color-neutral-800)] text-[var(--color-neutral-100)]",
  destructive: "border-transparent bg-red-950 text-red-200",
  outline: "border-accent text-accent",
  ghost: "border-transparent bg-transparent text-muted-foreground",
  link: "border-transparent bg-transparent text-accent underline-offset-4",
  success: "border-transparent bg-emerald-950 text-emerald-300",
  warning: "border-transparent bg-amber-950 text-amber-300",
  info: "border-transparent bg-[var(--color-accent-900)] text-[var(--color-accent-300)]",
};

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantMap[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
