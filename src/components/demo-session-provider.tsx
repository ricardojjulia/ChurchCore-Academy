"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getDemoVersion, isDemoModeEnabledClient } from "@/lib/demo-mode";

interface DemoSessionContextValue {
  enabled: boolean;
  sessionId: string;
  breadcrumbs: string[];
  sessionDurationSeconds: number;
  route: string;
  demoVersion: string;
}

const SESSION_ID_KEY = "academy-demo-session-id";
const SESSION_START_KEY = "academy-demo-session-start";
const SESSION_BREADCRUMBS_KEY = "academy-demo-breadcrumbs";

const DemoSessionContext = createContext<DemoSessionContextValue>({
  enabled: false,
  sessionId: "",
  breadcrumbs: [],
  sessionDurationSeconds: 0,
  route: "/",
  demoVersion: "dev",
});

function updateRecentRoutes(current: string[], route: string) {
  const next = [...current.filter((item) => item !== route), route];
  return next.slice(Math.max(0, next.length - 5));
}

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const enabled = isDemoModeEnabledClient();
  const pathname = usePathname();
  const [sessionId, setSessionId] = useState("");
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const demoVersion = getDemoVersion();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    let nextSessionId = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!nextSessionId) {
      nextSessionId = window.crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_ID_KEY, nextSessionId);
    }

    const storedStart = window.sessionStorage.getItem(SESSION_START_KEY);
    const startMs = storedStart ? Number(storedStart) : Date.now();
    const resolvedStartMs = Number.isFinite(startMs) ? startMs : Date.now();
    if (!storedStart) {
      window.sessionStorage.setItem(SESSION_START_KEY, String(resolvedStartMs));
    }

    const rawBreadcrumbs = window.sessionStorage.getItem(SESSION_BREADCRUMBS_KEY);
    let parsedBreadcrumbs: string[] = [];
    if (rawBreadcrumbs) {
      try {
        parsedBreadcrumbs = (JSON.parse(rawBreadcrumbs) as unknown[]).filter(
          (item): item is string => typeof item === "string",
        );
      } catch {
        parsedBreadcrumbs = [];
      }
    }

    const nextBreadcrumbs = updateRecentRoutes(parsedBreadcrumbs, pathname ?? "/");
    window.sessionStorage.setItem(SESSION_BREADCRUMBS_KEY, JSON.stringify(nextBreadcrumbs));

    queueMicrotask(() => {
      setSessionId(nextSessionId ?? "");
      setBreadcrumbs(nextBreadcrumbs);
      setSessionDurationSeconds(Math.floor((Date.now() - resolvedStartMs) / 1000));
    });
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const intervalId = window.setInterval(() => {
      const storedStart = window.sessionStorage.getItem(SESSION_START_KEY);
      const startMs = storedStart ? Number(storedStart) : Date.now();
      const resolvedStartMs = Number.isFinite(startMs) ? startMs : Date.now();
      setSessionDurationSeconds(Math.floor((Date.now() - resolvedStartMs) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [enabled]);

  const value = useMemo<DemoSessionContextValue>(
    () => ({
      enabled,
      sessionId,
      breadcrumbs,
      sessionDurationSeconds,
      route: pathname ?? "/",
      demoVersion,
    }),
    [breadcrumbs, demoVersion, enabled, pathname, sessionDurationSeconds, sessionId],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession() {
  return useContext(DemoSessionContext);
}
