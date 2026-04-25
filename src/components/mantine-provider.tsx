"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import type React from "react";

const theme = createTheme({
  primaryColor: "indigo",
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
      },
    },
    Card: {
      defaultProps: {
        radius: "md",
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
        {children}
        <Notifications position="top-right" />
      </ModalsProvider>
    </MantineProvider>
  );
}
