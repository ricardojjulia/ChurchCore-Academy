"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("[Academy/Student] Error boundary triggered. Digest:", error.digest);
    }
  }, [error]);

  return (
    <div className="student-pwa-error-boundary">
      <div className="student-pwa-error-content">
        <p className="student-pwa-error-eyebrow">ChurchCore Academy</p>
        <h1 className="student-pwa-error-title">Something went wrong</h1>
        <p className="student-pwa-error-copy">
          We were unable to load your student data. Your records are safe. Please try again.
        </p>
        <div className="student-pwa-error-actions">
          <button className="student-pwa-error-retry" onClick={reset}>Try again</button>
          <Link className="student-pwa-error-home" href="/student">Return to home</Link>
        </div>
        {error.digest && <p className="student-pwa-error-digest">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
