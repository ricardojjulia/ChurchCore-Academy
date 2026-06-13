"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AdmissionsConversionAction({
  applicationId,
}: {
  applicationId: string;
}) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function convert() {
    idempotencyKey.current ??= window.crypto.randomUUID();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/academy/admissions/applications/${applicationId}/convert`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey.current,
          },
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Enrollment conversion failed.");
      }
      router.refresh();
    } catch (conversionError) {
      setError(
        conversionError instanceof Error
          ? conversionError.message
          : "Enrollment conversion failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        loading={pending}
        disabled={pending}
        onClick={convert}
      >
        {pending ? "Converting" : "Convert to student"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
