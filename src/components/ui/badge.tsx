import { Badge as MantineBadge, type BadgeProps as MantineBadgeProps } from "@mantine/core";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";

const variantMap: Record<BadgeVariant, Pick<MantineBadgeProps, "color" | "variant">> = {
  default: { color: "indigo", variant: "filled" },
  secondary: { color: "gray", variant: "light" },
  destructive: { color: "red", variant: "light" },
  outline: { color: "gray", variant: "outline" },
  ghost: { color: "gray", variant: "subtle" },
  link: { color: "indigo", variant: "subtle" },
};

type BadgeProps = MantineBadgeProps & {
  variant?: BadgeVariant;
};

function Badge({ variant = "default", tt, ...props }: BadgeProps) {
  return <MantineBadge size="sm" radius="xl" tt={tt ?? "none"} {...variantMap[variant]} {...props} />;
}

export { Badge };
