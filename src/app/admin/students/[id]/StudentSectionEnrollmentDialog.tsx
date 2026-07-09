"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
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
import type { AvailableStudentSection } from "@/modules/student-section-enrollments/types";

interface StudentSectionEnrollmentDialogProps {
  studentProfileId: string;
  availableSectionOptions: AvailableStudentSection[];
  hasActiveProgramMembership: boolean;
}

export function StudentSectionEnrollmentDialog({
  studentProfileId,
  availableSectionOptions,
  hasActiveProgramMembership,
}: StudentSectionEnrollmentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courseSectionId, setCourseSectionId] = useState(availableSectionOptions[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const selectOptions = useMemo(
    () => availableSectionOptions.map((section) => ({
      value: section.id,
      label: `${section.courseCode} - ${section.courseTitle} (${section.sectionCode})`,
    })),
    [availableSectionOptions],
  );

  async function saveEnrollment() {
    setSaving(true);
    try {
      const response = await fetch(`/api/academy/students/${studentProfileId}/section-enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSectionId }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? "Failed to register section.");
      }

      notifyAcademy({
        tone: "success",
        title: "Section registered",
        message: "Student section registration was saved.",
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Section registration failed",
        message: error instanceof Error ? error.message : "Failed to register section.",
      });
    } finally {
      setSaving(false);
    }
  }

  const disabled = !hasActiveProgramMembership || availableSectionOptions.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} leftSection={<Plus className="h-4 w-4" />}>
          Register Section
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register section</DialogTitle>
          <DialogDescription>
            Add this student to an open course section for the selected academic period.
          </DialogDescription>
        </DialogHeader>
        {disabled ? (
          <div className="student-empty-state">
            <BookOpen />
            <span>
              {hasActiveProgramMembership
                ? "No eligible sections are currently available."
                : "Assign an active program membership before registering sections."}
            </span>
          </div>
        ) : (
          <Select
            label="Course section"
            data={selectOptions}
            value={courseSectionId}
            onChange={setCourseSectionId}
            placeholder="Select section"
            required
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={saveEnrollment} disabled={disabled || !courseSectionId} loading={saving}>
            Save Registration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
