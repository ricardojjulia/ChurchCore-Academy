"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { notifyAcademy } from "@/lib/ui/notifications";

export interface StudentProgramOption {
  id: string;
  programCode: string;
  title: string;
  status: string;
}

export interface StudentAcademicYearOption {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface StudentProgramMembershipDialogProps {
  studentProfileId: string;
  currentAcademicProgramId?: string;
  currentAcademicYearId?: string;
  academicProgramOptions: StudentProgramOption[];
  academicYearOptions: StudentAcademicYearOption[];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function titleize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StudentProgramMembershipDialog({
  studentProfileId,
  currentAcademicProgramId,
  currentAcademicYearId,
  academicProgramOptions,
  academicYearOptions,
}: StudentProgramMembershipDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [academicProgramId, setAcademicProgramId] = useState(currentAcademicProgramId ?? academicProgramOptions[0]?.id ?? "");
  const [catalogAcademicYearId, setCatalogAcademicYearId] = useState(currentAcademicYearId ?? academicYearOptions[0]?.id ?? "");
  const [startedOn, setStartedOn] = useState(today());
  const [saving, setSaving] = useState(false);

  const programSelectOptions = useMemo(
    () => academicProgramOptions.map((program) => ({
      value: program.id,
      label: `${program.programCode} - ${program.title}`,
    })),
    [academicProgramOptions],
  );

  const yearSelectOptions = useMemo(
    () => academicYearOptions.map((year) => ({
      value: year.id,
      label: `${year.name} (${titleize(year.status)})`,
    })),
    [academicYearOptions],
  );

  async function saveMembership() {
    setSaving(true);
    try {
      const response = await fetch(`/api/academy/students/${studentProfileId}/program-membership`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicProgramId,
          catalogAcademicYearId,
          startedOn,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? "Failed to save program membership.");
      }

      notifyAcademy({
        tone: "success",
        title: "Program membership saved",
        message: "Student program assignment was updated.",
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Program membership failed",
        message: error instanceof Error ? error.message : "Failed to save program membership.",
      });
    } finally {
      setSaving(false);
    }
  }

  const disabled = academicProgramOptions.length === 0 || academicYearOptions.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} leftSection={<GraduationCap className="h-4 w-4" />}>
          {currentAcademicProgramId ? "Change Program" : "Assign Program"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Student program membership</DialogTitle>
          <DialogDescription>
            Assign the active academic program and catalog year for this student record.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Select
            label="Academic program"
            data={programSelectOptions}
            value={academicProgramId}
            onChange={setAcademicProgramId}
            placeholder="Select program"
            required
          />
          <Select
            label="Catalog academic year"
            data={yearSelectOptions}
            value={catalogAcademicYearId}
            onChange={setCatalogAcademicYearId}
            placeholder="Select catalog year"
            required
          />
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Start date
            <input
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="date"
              value={startedOn}
              onChange={(event) => setStartedOn(event.currentTarget.value)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={saveMembership} disabled={disabled || !academicProgramId || !catalogAcademicYearId} loading={saving}>
            Save Membership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
