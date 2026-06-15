"use client";

import type React from "react";
import { DemoFeedbackButton } from "@/components/demo-feedback-button";
import { DemoAppErrorBoundary } from "@/components/demo-error-boundary";
import { DemoSessionProvider } from "@/components/demo-session-provider";
import { SkipNavLink } from "@/components/academy/skip-nav-link";
import { ToastViewport } from "@/components/ui/toast-viewport";

export function AcademyAppProvider({ children }: { children: React.ReactNode }) {
  return (
    <DemoSessionProvider>
      <DemoAppErrorBoundary>
        <SkipNavLink />
        {children}
        <DemoFeedbackButton />
        <ToastViewport />
      </DemoAppErrorBoundary>
    </DemoSessionProvider>
  );
}
