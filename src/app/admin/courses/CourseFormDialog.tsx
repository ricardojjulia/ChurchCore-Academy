"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { notifyAcademy } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import type { Course } from "@/modules/course-catalog/types";

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  course?: Course;
}

type FormData = {
  code: string;
  title: string;
  description: string;
  courseType: string;
  courseLevel: string;
  defaultCredits: number;
  defaultClockHours: number;
};

const COURSE_TYPE_OPTIONS = [
  { value: "bible_course", label: "Bible Course" },
  { value: "general_education", label: "General Education" },
  { value: "major_requirement", label: "Major Requirement" },
  { value: "elective", label: "Elective" },
  { value: "seminary_course", label: "Seminary Course" },
  { value: "ministry_practicum", label: "Ministry Practicum" },
  { value: "lab", label: "Lab" },
  { value: "children_class", label: "Children's Class" },
  { value: "custom", label: "Custom" },
];

const COURSE_LEVEL_OPTIONS = [
  { value: "children", label: "Children" },
  { value: "certificate", label: "Certificate" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate" },
  { value: "continuing_education", label: "Continuing Education" },
];

export function CourseFormDialog({ open, onOpenChange, mode, course }: CourseFormDialogProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (mode === "edit" && course) {
      reset({
        code: course.code,
        title: course.title,
        description: course.description,
        courseType: course.courseType,
        courseLevel: course.courseLevel,
        defaultCredits: course.defaultCredits ?? 0,
        defaultClockHours: course.defaultClockHours ?? 0,
      });
    } else if (mode === "create") {
      reset({
        code: "",
        title: "",
        description: "",
        courseType: "bible_course",
        courseLevel: "undergraduate",
        defaultCredits: 3,
        defaultClockHours: 0,
      });
    }
  }, [mode, course, open, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        code: data.code.toUpperCase(),
        title: data.title,
        description: data.description,
        courseType: data.courseType,
        courseLevel: data.courseLevel,
        recordType: "official_transcript",
        defaultDuration: {
          durationUnit: data.defaultCredits > 0 ? "credit_hour" : "clock_hour",
          durationValue: data.defaultCredits > 0 ? data.defaultCredits : data.defaultClockHours,
          creditHours: data.defaultCredits || undefined,
          clockHours: data.defaultClockHours || undefined,
        },
        defaultCredits: data.defaultCredits || undefined,
        defaultClockHours: data.defaultClockHours || undefined,
      };

      const url = mode === "create" ? "/api/academy/courses" : `/api/academy/courses/${course?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? `Failed to ${mode} course.`);
      }

      notifyAcademy({
        tone: "success",
        title: mode === "create" ? "Course created" : "Course updated",
        message: `Course successfully ${mode === "create" ? "created" : "updated"}.`,
      });

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: mode === "create" ? "Creation failed" : "Update failed",
        message: error instanceof Error ? error.message : `Failed to ${mode} course.`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create New Course" : "Edit Course"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new course to the catalog. It will be created in draft status."
              : "Update the course details. Some fields may be locked if sections are assigned."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} id="course-form" className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">Course Code</Label>
            <Input
              id="code"
              {...register("code", { required: true })}
              className="col-span-3 font-mono"
              placeholder="BIB101"
              onBlur={(e) => {
                e.target.value = e.target.value.toUpperCase();
              }}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Title</Label>
            <Input
              id="title"
              {...register("title", { required: true })}
              className="col-span-3"
              placeholder="Introduction to Biblical Studies"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Textarea
              id="description"
              {...register("description", { required: mode === "create" })}
              className="col-span-3"
              placeholder="Course description..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="courseType" className="text-right">Course Type</Label>
            <div className="col-span-3">
              <Controller
                name="courseType"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="courseType"
                    value={field.value}
                    onChange={field.onChange}
                    data={COURSE_TYPE_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="courseLevel" className="text-right">Course Level</Label>
            <div className="col-span-3">
              <Controller
                name="courseLevel"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="courseLevel"
                    value={field.value}
                    onChange={field.onChange}
                    data={COURSE_LEVEL_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="defaultCredits" className="text-right">Credit Hours</Label>
            <Input
              id="defaultCredits"
              type="number"
              {...register("defaultCredits", { valueAsNumber: true })}
              className="col-span-3"
              min="0"
              step="0.5"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="defaultClockHours" className="text-right">Clock Hours</Label>
            <Input
              id="defaultClockHours"
              type="number"
              {...register("defaultClockHours", { valueAsNumber: true })}
              className="col-span-3"
              min="0"
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="course-form" disabled={isSubmitting}>
            {isSubmitting ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Course" : "Save Changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
