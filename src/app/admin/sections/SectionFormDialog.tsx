"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Plus } from "lucide-react";
import { notifyAcademy } from "@/lib/ui/notifications";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { InstructionalRoleLabel } from "@/modules/academy-config/types";
import type { CourseSection, DeliveryMode } from "@/modules/course-catalog/types";

export interface SectionCourseOption {
  id: string;
  code: string;
  title: string;
}

export interface SectionPeriodOption {
  id: string;
  name: string;
  academicYearName: string;
}

export interface SectionInstructorOption {
  personId: string;
  displayName: string;
}

export interface SectionSubdivisionOption {
  id: string;
  name: string;
}

interface SectionFormDialogProps {
  mode: "create" | "edit";
  courses: SectionCourseOption[];
  periods: SectionPeriodOption[];
  instructors: SectionInstructorOption[];
  subdivisions: SectionSubdivisionOption[];
  section?: CourseSection;
}

const deliveryModeOptions = [
  { value: "in_person", label: "In Person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
  { value: "independent_study", label: "Independent Study" },
  { value: "field_practicum", label: "Field Practicum" },
  { value: "chapel", label: "Chapel" },
  { value: "custom", label: "Custom" },
];

const roleOptions: Array<{ value: InstructionalRoleLabel; label: string }> = [
  { value: "professor", label: "Professor" },
  { value: "teacher", label: "Teacher" },
  { value: "instructor", label: "Instructor" },
  { value: "faculty", label: "Faculty" },
];

function toNumber(value: string) {
  return value.trim() ? Number(value) : undefined;
}

export function SectionFormDialog({
  mode,
  courses,
  periods,
  instructors,
  subdivisions,
  section,
}: SectionFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(section?.courseId ?? courses[0]?.id ?? "");
  const [academicPeriodId, setAcademicPeriodId] = useState(section?.academicPeriodId ?? periods[0]?.id ?? "");
  const [subdivisionId, setSubdivisionId] = useState(section?.subdivisionId ?? "");
  const [sectionCode, setSectionCode] = useState(section?.sectionCode ?? "");
  const [titleOverride, setTitleOverride] = useState(section?.titleOverride ?? "");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(section?.deliveryMode ?? "in_person");
  const [schedulePattern, setSchedulePattern] = useState(section?.schedulePattern ?? "");
  const [capacity, setCapacity] = useState(section?.capacity != null ? String(section.capacity) : "");
  const [primaryInstructorRole, setPrimaryInstructorRole] = useState<InstructionalRoleLabel>(
    section?.primaryInstructorRole ?? "professor",
  );
  const [primaryInstructorId, setPrimaryInstructorId] = useState(section?.primaryInstructorId ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const payload = mode === "create"
      ? {
          courseId,
          academicPeriodId,
          subdivisionId: subdivisionId || undefined,
          sectionCode,
          titleOverride: titleOverride || undefined,
          deliveryMode,
          schedulePattern: schedulePattern || undefined,
          capacity: toNumber(capacity),
          primaryInstructorRole,
          primaryInstructorId: primaryInstructorId || undefined,
        }
      : {
          titleOverride,
          deliveryMode,
          schedulePattern,
          capacity: toNumber(capacity),
          primaryInstructorRole,
          primaryInstructorId,
        };

    try {
      const url = mode === "create" ? "/api/academy/sections" : `/api/academy/sections/${section?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? "Section save failed.");
      }

      notifyAcademy({
        tone: "success",
        title: mode === "create" ? "Section created" : "Section updated",
        message: mode === "create"
          ? "The course section is ready for scheduling review."
          : "The course section was updated.",
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Section save failed",
        message: error instanceof Error ? error.message : "Section save failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCreate = mode === "create";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isCreate ? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Section
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,44rem)]">
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isCreate ? "Create Section" : "Edit Section"}</DialogTitle>
            <DialogDescription>
              {isCreate
                ? "Schedule a course offering for an academic period."
                : "Update section staffing, delivery, schedule, and capacity."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Course"
              placeholder="Select course"
              data={courses.map((course) => ({
                value: course.id,
                label: `${course.code} - ${course.title}`,
              }))}
              value={courseId}
              onChange={setCourseId}
              disabled={!isCreate || isSubmitting}
              required
            />
            <Select
              label="Academic Period"
              placeholder="Select period"
              data={periods.map((period) => ({
                value: period.id,
                label: `${period.name} (${period.academicYearName})`,
              }))}
              value={academicPeriodId}
              onChange={setAcademicPeriodId}
              disabled={!isCreate || isSubmitting}
              required
            />
            <div className="grid gap-2">
              <Label htmlFor={`${mode}-section-code`}>Section Code</Label>
              <Input
                id={`${mode}-section-code`}
                value={sectionCode}
                onChange={(event) => setSectionCode(event.currentTarget.value)}
                disabled={!isCreate || isSubmitting}
                placeholder="BIB101-01"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${mode}-title-override`}>Title Override</Label>
              <Input
                id={`${mode}-title-override`}
                value={titleOverride}
                onChange={(event) => setTitleOverride(event.currentTarget.value)}
                disabled={isSubmitting}
                placeholder="Optional section title"
              />
            </div>
            <Select
              label="Delivery Mode"
              data={deliveryModeOptions}
              value={deliveryMode}
              onChange={(value) => setDeliveryMode(value as DeliveryMode)}
              disabled={isSubmitting}
              required
            />
            <Select
              label="Subdivision"
              placeholder="No subdivision"
              data={subdivisions.map((subdivision) => ({
                value: subdivision.id,
                label: subdivision.name,
              }))}
              value={subdivisionId}
              onChange={setSubdivisionId}
              disabled={!isCreate || isSubmitting}
            />
            <Select
              label="Primary Instructor"
              placeholder="Unassigned"
              data={instructors.map((instructor) => ({
                value: instructor.personId,
                label: instructor.displayName,
              }))}
              value={primaryInstructorId}
              onChange={setPrimaryInstructorId}
              disabled={isSubmitting}
            />
            <Select
              label="Instructor Role"
              data={roleOptions}
              value={primaryInstructorRole}
              onChange={(value) => setPrimaryInstructorRole(value as InstructionalRoleLabel)}
              disabled={isSubmitting}
              required
            />
            <div className="grid gap-2">
              <Label htmlFor={`${mode}-schedule-pattern`}>Schedule Pattern</Label>
              <Input
                id={`${mode}-schedule-pattern`}
                value={schedulePattern}
                onChange={(event) => setSchedulePattern(event.currentTarget.value)}
                disabled={isSubmitting}
                placeholder="Tue/Thu 9:00-10:15"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${mode}-capacity`}>Capacity</Label>
              <Input
                id={`${mode}-capacity`}
                type="number"
                min="0"
                value={capacity}
                onChange={(event) => setCapacity(event.currentTarget.value)}
                disabled={isSubmitting}
                placeholder="30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !courseId || !academicPeriodId || !sectionCode}>
              {isSubmitting ? "Saving..." : isCreate ? "Create Section" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
