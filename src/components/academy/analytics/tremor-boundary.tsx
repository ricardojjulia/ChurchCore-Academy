"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TremorBoundary({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-academy", className)} data-tremor-boundary>
      <header className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}
