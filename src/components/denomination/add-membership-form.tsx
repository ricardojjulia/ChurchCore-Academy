"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";

const membershipStatusOptions: SelectOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "transferred", label: "Transferred" },
  { value: "unknown", label: "Unknown" },
];

interface AddDenominationMembershipFormProps {
  personId: string;
}

export function AddDenominationMembershipForm({ personId }: AddDenominationMembershipFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [denominationName, setDenominationName] = useState("");
  const [localChurchName, setLocalChurchName] = useState("");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [membershipStatus, setMembershipStatus] = useState("active");
  const [membershipDate, setMembershipDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/academy/people/${personId}/denomination-memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          denominationName,
          localChurchName: localChurchName || undefined,
          membershipNumber: membershipNumber || undefined,
          membershipStatus,
          membershipDate: membershipDate || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add membership");
      }

      setOpen(false);
      // Reset form
      setDenominationName("");
      setLocalChurchName("");
      setMembershipNumber("");
      setMembershipStatus("active");
      setMembershipDate("");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add membership");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus size={16} />
          Add Membership
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Denomination Membership</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <label className="grid gap-2 text-sm font-medium">
            <span>Denomination <span className="text-destructive">*</span></span>
            <Input
              type="text"
              value={denominationName}
              onChange={(e) => setDenominationName(e.target.value)}
              placeholder="e.g., Assemblies of God"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Local Church</span>
            <Input
              type="text"
              value={localChurchName}
              onChange={(e) => setLocalChurchName(e.target.value)}
              placeholder="e.g., First Assembly of God"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Membership Number</span>
            <Input
              type="text"
              value={membershipNumber}
              onChange={(e) => setMembershipNumber(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <Select
            label="Membership Status"
            data={membershipStatusOptions}
            value={membershipStatus}
            onChange={(value) => setMembershipStatus(value)}
            required
          />

          <label className="grid gap-2 text-sm font-medium">
            <span>Membership Date</span>
            <Input
              type="date"
              value={membershipDate}
              onChange={(e) => setMembershipDate(e.target.value)}
            />
          </label>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding..." : "Add Membership"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
