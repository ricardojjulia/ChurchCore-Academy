"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";
import type { AlumniRecord } from "@/modules/people/alumni";

const statusOptions: SelectOption[] = [
  { value: "active", label: "Active" },
  { value: "lost_contact", label: "Lost Contact" },
  { value: "deceased", label: "Deceased" },
];

interface UpdateAlumniFormProps {
  currentRecord: AlumniRecord;
}

export function UpdateAlumniForm({ currentRecord }: UpdateAlumniFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [employer, setEmployer] = useState(currentRecord.employer || "");
  const [jobTitle, setJobTitle] = useState(currentRecord.jobTitle || "");
  const [location, setLocation] = useState(currentRecord.location || "");
  const [status, setStatus] = useState(currentRecord.status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/academy/alumni/${currentRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Explicit null (not undefined) for a blanked field: updateAlumniRecord treats
          // undefined as "leave unchanged" and null as "clear it" — this form always submits
          // the full current state, so a blank field means the admin cleared it.
          employer: employer || null,
          jobTitle: jobTitle || null,
          location: location || null,
          status,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update alumni record");
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update alumni record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit size={16} />
          Update Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Alumni Record</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <label className="grid gap-2 text-sm font-medium">
            <span>Employer</span>
            <Input
              type="text"
              value={employer}
              onChange={(e) => setEmployer(e.target.value)}
              placeholder="Current employer"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Job Title</span>
            <Input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Current position"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Location</span>
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, State or City, Country"
            />
          </label>

          <Select
            label="Status"
            data={statusOptions}
            value={status}
            onChange={(value) => setStatus(value as typeof status)}
          />

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
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
