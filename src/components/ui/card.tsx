import * as React from "react";
import { Card as MantineCard, Text, Title } from "@mantine/core";
import { cn } from "@/lib/utils";

function Card({ className, children, ...props }: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <MantineCard className={className} shadow="xs" padding="md" {...props}>
      {children}
    </MantineCard>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mantine-card-header", className)} {...props} />;
}

function CardTitle({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <Title order={3} className={className} {...props}>
      {children}
    </Title>
  );
}

function CardDescription({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <Text size="sm" c="dimmed" className={className} {...props}>
      {children}
    </Text>
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={className} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mantine-card-content", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={className} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
