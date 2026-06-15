interface LoadingIndicatorProps {
  message?: string;
  variant?: "ai" | "default";
}

/**
 * Loading / Streaming Indicator following LMS UI spec section 7.8
 * 
 * Three pulsing dots — used for all async operations (AI streaming, report generation, search):
 * - AI features: bg-violet-400
 * - Generic loading: bg-primary/60
 */
export function LoadingIndicator({
  message = "Loading...",
  variant = "default",
}: LoadingIndicatorProps) {
  const dotColor = variant === "ai" ? "bg-violet-400" : "bg-primary/60";

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground py-3">
      <span className="flex gap-1">
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-bounce [animation-delay:0ms]`}
        />
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-bounce [animation-delay:150ms]`}
        />
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-bounce [animation-delay:300ms]`}
        />
      </span>
      {message}
    </div>
  );
}