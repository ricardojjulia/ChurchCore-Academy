"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarkAcknowledgedButtonProps {
  giftId: string;
}

export function MarkAcknowledgedButton({ giftId }: MarkAcknowledgedButtonProps) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);

  const handleClick = async () => {
    setMarking(true);

    try {
      const response = await fetch(`/api/academy/alumni/gifts/${giftId}/acknowledge`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark gift as acknowledged");
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to mark gift as acknowledged");
    } finally {
      setMarking(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={marking}
    >
      <Check size={14} />
      {marking ? "Marking..." : "Mark Acknowledged"}
    </Button>
  );
}
