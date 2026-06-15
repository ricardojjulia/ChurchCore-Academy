import * as React from "react";
import { cn } from "@/lib/utils";

type TextareaProps = Omit<React.ComponentProps<"textarea">, "size"> & {
  size?: "xs" | "sm" | "md" | "lg";
};

function Textarea({ className, size: _size, ...props }: TextareaProps) {
  void _size;

  return (
    <textarea
      className={cn(
        "flex min-h-[7rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
