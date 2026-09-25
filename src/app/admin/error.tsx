"use client";

import Link from "next/link";
import { useEffect } from "react";
import { isAuthorizationDenial } from "@/modules/academy-auth/errors";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("[Academy/Admin] Error boundary triggered. Digest:", error.digest);
    }
  }, [error]);

  // Error subclasses don't survive the server/client boundary as instanceof-checkable types,
  // and production builds also replace the message. AcademyAuthorizationError carries a fixed
  // digest that Next.js preserves, so that's what identifies a denial in production.
  if (isAuthorizationDenial(error)) {
    return (
      <div className="ops-error-boundary">
        <div className="ops-error-content">
          <p className="ops-error-eyebrow">Admin Portal</p>
          <h1 className="ops-error-title">You don&apos;t have access to this page</h1>
          <p className="ops-error-copy">
            Your account doesn&apos;t have permission to view this section. If you believe this is a mistake, contact an
            institution administrator.
          </p>
          <div className="ops-error-actions">
            <Link className="ops-error-home" href="/admin">Return to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ops-error-boundary">
      <div className="ops-error-content">
        <p className="ops-error-eyebrow">Admin Portal</p>
        <h1 className="ops-error-title">Unable to load this page</h1>
        <p className="ops-error-copy">
          An error occurred while loading admin data. Your records are safe. Please try again or return to the dashboard.
        </p>
        <div className="ops-error-actions">
          <button className="ops-error-retry" onClick={reset}>Try again</button>
          <Link className="ops-error-home" href="/admin">Return to dashboard</Link>
        </div>
        {error.digest && <p className="ops-error-digest">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
