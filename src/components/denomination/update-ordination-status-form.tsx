"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectOption } from "@/components/ui/select";
import type { OrdinationRecord } from "@/modules/people/denomination";

const ordinationStatusOptions: SelectOption[] = [
  { value: "active", label: "Active" },
  { value: "revoked", label: "Revoked" },
  { value: "retired", label: "Retired" },
  { value: "suspended", label: "Suspended" },
];

interface UpdateOrdinationStatusFormProps {
  personId: string;
  ordination: OrdinationRecord;
}

export function UpdateOrdinationStatusForm({
  personId,
  ordination,
}: UpdateOrdinationStatusFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [ordinationStatus, setOrdinationStatus] = useState(ordination.ordinationStatus);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(
        `/api/academy/people/${personId}/ordinations/${ordination.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ordinationStatus,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update ordination status");
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update ordination status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit size={14} />
          Update Status
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Update Status: {ordination.ordinationType} ({ordination.ordainingBody})
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <Select
            label="Ordination Status"
            data={ordinationStatusOptions}
            value={ordinationStatus}
            onChange={(value) =>
              setOrdinationStatus(value as "active" | "revoked" | "retired" | "suspended")
            }
            required
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Updating..." : "Update Status"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
