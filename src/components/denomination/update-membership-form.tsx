"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";
import type { DenominationMembershipRecord } from "@/modules/people/denomination";

const membershipStatusOptions: SelectOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "transferred", label: "Transferred" },
  { value: "unknown", label: "Unknown" },
];

interface UpdateDenominationMembershipFormProps {
  personId: string;
  membership: DenominationMembershipRecord;
}

export function UpdateDenominationMembershipForm({
  personId,
  membership,
}: UpdateDenominationMembershipFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [membershipStatus, setMembershipStatus] = useState(membership.membershipStatus);
  const [transferDate, setTransferDate] = useState(membership.transferDate || "");
  const [notes, setNotes] = useState(membership.notes || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(
        `/api/academy/people/${personId}/denomination-memberships/${membership.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Send the controlled value as-is, including an empty string — the service
            // already converts "" to null, but treats `undefined` as "leave unchanged". A
            // cleared field must reach the server as "", not be swallowed into `undefined`,
            // or an existing transfer date or note could never be cleared from this form.
            // Found via code review.
            membershipStatus,
            transferDate,
            notes,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update membership");
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update membership");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit size={14} />
          Update
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Membership: {membership.denominationName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <Select
            label="Membership Status"
            data={membershipStatusOptions}
            value={membershipStatus}
            onChange={(value) =>
              setMembershipStatus(value as "active" | "inactive" | "transferred" | "unknown")
            }
            required
          />

          <label className="grid gap-2 text-sm font-medium">
            <span>Transfer Date</span>
            <Input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Notes</span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this membership"
              rows={3}
            />
          </label>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
