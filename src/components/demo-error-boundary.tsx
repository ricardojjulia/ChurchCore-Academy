"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useDemoSession } from "@/components/demo-session-provider";
import { notifyAcademy } from "@/lib/ui/notifications";
import { reportCapturedDemoError } from "@/modules/demo-feedback/client-reporting";

interface DemoErrorBoundaryState {
  hasError: boolean;
}

class DemoErrorBoundaryClass extends React.Component<
  {
    enabled: boolean;
    session: {
      sessionId: string;
      breadcrumbs: string[];
      sessionDurationSeconds: number;
      route: string;
      demoVersion: string;
    };
    children: React.ReactNode;
  },
  DemoErrorBoundaryState
> {
  state: DemoErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (!this.props.enabled) {
      return;
    }

    notifyAcademy({
      tone: "warning",
      title: "Error captured",
      message: "A demo error was captured for triage.",
    });

    // Never block the original error flow when reporting telemetry.
    void reportCapturedDemoError(this.props.session, error.message ?? "Unhandled UI error");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="demo-error-fallback" role="alert">
          <h2>Something went wrong</h2>
          <p>This screen hit an unexpected error.</p>
          <Button onClick={() => this.setState({ hasError: false })}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function DemoAppErrorBoundary({ children }: { children: React.ReactNode }) {
  const session = useDemoSession();

  return (
    <DemoErrorBoundaryClass
      enabled={session.enabled}
      session={{
        sessionId: session.sessionId,
        breadcrumbs: session.breadcrumbs,
        sessionDurationSeconds: session.sessionDurationSeconds,
        route: session.route,
        demoVersion: session.demoVersion,
      }}
    >
      {children}
    </DemoErrorBoundaryClass>
  );
}
