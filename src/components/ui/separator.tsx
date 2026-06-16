"use client";

import { cn } from "@/lib/utils";

function Separator({ orientation = "horizontal", className }: { orientation?: "horizontal" | "vertical"; className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(orientation === "vertical" ? "h-full w-px bg-border" : "h-px w-full bg-border", className)}
    />
  );
}

export { Separator };
