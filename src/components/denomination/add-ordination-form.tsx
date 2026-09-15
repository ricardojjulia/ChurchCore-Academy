"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";

const ordinationTypeOptions: SelectOption[] = [
  { value: "deacon", label: "Deacon" },
  { value: "elder", label: "Elder" },
  { value: "minister", label: "Minister" },
  { value: "bishop", label: "Bishop" },
  { value: "pastor", label: "Pastor" },
  { value: "evangelist", label: "Evangelist" },
  { value: "other", label: "Other" },
];

const ordinationStatusOptions: SelectOption[] = [
  { value: "active", label: "Active" },
  { value: "revoked", label: "Revoked" },
  { value: "retired", label: "Retired" },
  { value: "suspended", label: "Suspended" },
];

interface AddOrdinationFormProps {
  personId: string;
}

export function AddOrdinationForm({ personId }: AddOrdinationFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [ordinationType, setOrdinationType] = useState("minister");
  const [ordainingBody, setOrdainingBody] = useState("");
  const [ordinationDate, setOrdinationDate] = useState("");
  const [ordinationStatus, setOrdinationStatus] = useState("active");
  const [credentialsNumber, setCredentialsNumber] = useState("");
  const [renewalDate, setRenewalDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/academy/people/${personId}/ordinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordinationType,
          ordainingBody,
          ordinationDate,
          ordinationStatus,
          credentialsNumber: credentialsNumber || undefined,
          renewalDate: renewalDate || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to record ordination");
      }

      setOpen(false);
      // Reset form
      setOrdinationType("minister");
      setOrdainingBody("");
      setOrdinationDate("");
      setOrdinationStatus("active");
      setCredentialsNumber("");
      setRenewalDate("");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to record ordination");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus size={16} />
          Add Ordination
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Ordination</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <Select
            label="Ordination Type"
            data={ordinationTypeOptions}
            value={ordinationType}
            onChange={(value) => setOrdinationType(value)}
            required
          />

          <label className="grid gap-2 text-sm font-medium">
            <span>Ordaining Body <span className="text-destructive">*</span></span>
            <Input
              type="text"
              value={ordainingBody}
              onChange={(e) => setOrdainingBody(e.target.value)}
              placeholder="e.g., Southern Baptist Convention"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Ordination Date <span className="text-destructive">*</span></span>
            <Input
              type="date"
              value={ordinationDate}
              onChange={(e) => setOrdinationDate(e.target.value)}
              required
            />
          </label>

          <Select
            label="Ordination Status"
            data={ordinationStatusOptions}
            value={ordinationStatus}
            onChange={(value) => setOrdinationStatus(value)}
            required
          />

          <label className="grid gap-2 text-sm font-medium">
            <span>Credentials Number</span>
            <Input
              type="text"
              value={credentialsNumber}
              onChange={(e) => setCredentialsNumber(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Renewal Date</span>
            <Input
              type="date"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
            />
            <span className="text-xs font-normal text-muted-foreground">
              If credentials require periodic renewal
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Recording..." : "Record Ordination"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
