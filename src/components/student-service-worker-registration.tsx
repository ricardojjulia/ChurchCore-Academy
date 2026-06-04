"use client";

import { useEffect } from "react";
import { studentOfflinePolicy } from "@/modules/student-pwa/offline-policy";

export function StudentServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register(studentOfflinePolicy.serviceWorkerUrl, {
      scope: studentOfflinePolicy.scope,
    });

    const clearShellCache = () => {
      navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_STUDENT_SHELL_CACHE" });
    };

    window.addEventListener("academy:student-logout", clearShellCache);
    return () => window.removeEventListener("academy:student-logout", clearShellCache);
  }, []);

  return null;
}
