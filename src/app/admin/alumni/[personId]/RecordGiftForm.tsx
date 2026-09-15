"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";

const giftTypeOptions: SelectOption[] = [
  { value: "one_time", label: "One Time" },
  { value: "recurring", label: "Recurring" },
  { value: "pledge", label: "Pledge" },
];

interface RecordGiftFormProps {
  personId: string;
}

export function RecordGiftForm({ personId }: RecordGiftFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [giftAmountDollars, setGiftAmountDollars] = useState("");
  const [giftDate, setGiftDate] = useState("");
  const [giftType, setGiftType] = useState("one_time");
  const [fundDesignation, setFundDesignation] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const dollars = parseFloat(giftAmountDollars);
      if (isNaN(dollars) || dollars <= 0) {
        throw new Error("Gift amount must be a positive number");
      }
      const giftAmountCents = Math.round(dollars * 100);

      const response = await fetch(`/api/academy/alumni/${personId}/gifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftAmountCents,
          giftDate,
          giftType,
          fundDesignation: fundDesignation || undefined,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to record gift");
      }

      setOpen(false);
      // Reset form
      setGiftAmountDollars("");
      setGiftDate("");
      setGiftType("one_time");
      setFundDesignation("");
      setNotes("");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to record gift");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus size={16} />
          Record Gift
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Gift</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <label className="grid gap-2 text-sm font-medium">
            <span>Gift Amount <span className="text-destructive">*</span></span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={giftAmountDollars}
              onChange={(e) => setGiftAmountDollars(e.target.value)}
              placeholder="0.00"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Gift Date <span className="text-destructive">*</span></span>
            <Input
              type="date"
              value={giftDate}
              onChange={(e) => setGiftDate(e.target.value)}
              required
            />
          </label>

          <Select
            label="Gift Type"
            data={giftTypeOptions}
            value={giftType}
            onChange={(value) => setGiftType(value)}
          />

          <label className="grid gap-2 text-sm font-medium">
            <span>Fund Designation</span>
            <Input
              type="text"
              value={fundDesignation}
              onChange={(e) => setFundDesignation(e.target.value)}
              placeholder="e.g., Scholarship Fund, General Fund"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Notes</span>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </label>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Recording..." : "Record Gift"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
