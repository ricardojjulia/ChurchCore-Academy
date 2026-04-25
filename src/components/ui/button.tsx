"use client";

import * as React from "react";
import { ActionIcon, Button as MantineButton, type ButtonProps as MantineButtonProps } from "@mantine/core";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

const variantMap: Record<ButtonVariant, Pick<MantineButtonProps, "color" | "variant">> = {
  default: { color: "indigo", variant: "filled" },
  outline: { color: "gray", variant: "outline" },
  secondary: { color: "gray", variant: "light" },
  ghost: { color: "gray", variant: "subtle" },
  destructive: { color: "red", variant: "light" },
  link: { color: "indigo", variant: "subtle" },
};

const sizeMap: Record<ButtonSize, MantineButtonProps["size"]> = {
  default: "xs",
  xs: "compact-xs",
  sm: "xs",
  lg: "sm",
  icon: "sm",
  "icon-xs": "xs",
  "icon-sm": "sm",
  "icon-lg": "md",
};

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> &
  Pick<MantineButtonProps, "leftSection" | "rightSection" | "loading"> & {
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
  ...props
}: ButtonProps) {
  void nativeButton;
  const visualProps = variantMap[variant];
  const isIcon = size.startsWith("icon");

  if (render) {
    return React.cloneElement(render, {
      className: cn("mantine-focus-auto mantine-active", className, render.props.className),
      children,
    });
  }

  if (isIcon) {
    return (
      <ActionIcon
        type={props.type}
        className={className}
        size={sizeMap[size]}
        color={visualProps.color}
        variant={visualProps.variant}
        disabled={props.disabled}
        onClick={props.onClick}
        aria-label={props["aria-label"] ?? (typeof children === "string" ? children : "Action")}
      >
        {children}
      </ActionIcon>
    );
  }

  return (
    <MantineButton className={className} size={sizeMap[size]} {...visualProps} {...props}>
      {children}
    </MantineButton>
  );
}

export { Button };
