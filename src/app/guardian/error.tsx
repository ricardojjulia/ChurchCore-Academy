"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GuardianError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("[Academy/Guardian] Error boundary triggered. Digest:", error.digest);
    }
  }, [error]);

  return (
    <div className="ops-error-boundary">
      <div className="ops-error-content">
        <p className="ops-error-eyebrow">Guardian Portal</p>
        <h1 className="ops-error-title">Unable to load this page</h1>
        <p className="ops-error-copy">
          An error occurred while loading your guardian data. Please try again or return to your portal home.
        </p>
        <div className="ops-error-actions">
          <button className="ops-error-retry" onClick={reset}>Try again</button>
          <Link className="ops-error-home" href="/guardian">Return to portal</Link>
        </div>
        {error.digest && <p className="ops-error-digest">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
