"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import type React from "react";
import { DemoFeedbackButton } from "@/components/demo-feedback-button";
import { DemoAppErrorBoundary } from "@/components/demo-error-boundary";
import { DemoSessionProvider } from "@/components/demo-session-provider";

const theme = createTheme({
  primaryColor: "gray",
  defaultRadius: "md",
  fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
  headings: {
    fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
    fontWeight: "650",
  },
  components: {
    Button: {
      defaultProps: {
        size: "xs",
        radius: "xl",
      },
    },
    Card: {
      defaultProps: {
        radius: "lg",
        withBorder: true,
      },
    },
    Table: {
      defaultProps: {
        verticalSpacing: "sm",
        horizontalSpacing: "sm",
      },
    },
  },
});

export function AcademyMantineProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <ModalsProvider>
        <DemoSessionProvider>
          <DemoAppErrorBoundary>
            {children}
            <DemoFeedbackButton />
          </DemoAppErrorBoundary>
        </DemoSessionProvider>
        <Notifications position="top-right" />
      </ModalsProvider>
    </MantineProvider>
  );
}
