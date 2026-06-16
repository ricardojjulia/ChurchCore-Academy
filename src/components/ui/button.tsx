"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

const variantMap: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  outline: "border border-input bg-background hover:bg-muted hover:text-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-muted hover:text-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  link: "h-auto p-0 text-primary underline-offset-4 hover:underline",
};

const sizeMap: Record<ButtonSize, string> = {
  default: "h-9 px-4 py-2 text-sm",
  xs: "h-7 px-2.5 text-xs",
  sm: "h-8 px-3 text-sm",
  lg: "h-11 px-6 text-base",
  icon: "h-9 w-9 p-0",
  "icon-xs": "h-7 w-7 p-0",
  "icon-sm": "h-8 w-8 p-0",
  "icon-lg": "h-11 w-11 p-0",
};

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> &
  {
    leftSection?: React.ReactNode;
    rightSection?: React.ReactNode;
    loading?: boolean;
    variant?: ButtonVariant;
    size?: ButtonSize;
    render?: React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    nativeButton?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  children,
  disabled,
  loading,
  leftSection,
  rightSection,
  ...props
}: ButtonProps) {
  void nativeButton;
  const buttonClassName = cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    variantMap[variant],
    sizeMap[size],
    className,
  );
  const content = (
    <>
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : leftSection}
      {children}
      {rightSection}
    </>
  );

  if (render) {
    const renderClassName = render.props?.className;

    return React.cloneElement(render, {
      className: cn(buttonClassName, renderClassName),
      children: content,
    });
  }

  return (
    <button className={buttonClassName} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
}

export { Button };
