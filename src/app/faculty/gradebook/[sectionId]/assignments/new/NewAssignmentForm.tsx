"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { notifyAcademy } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

interface NewAssignmentFormProps {
  sectionId: string;
}

type FormData = {
  title: string;
  description: string;
  dueDate: string;
  maxPoints: number;
  weight: number;
  gradingType: string;
  assignmentType: string;
};

const GRADING_TYPE_OPTIONS = [
  { value: "points", label: "Points" },
  { value: "pass_fail", label: "Pass / Fail" },
  { value: "rubric", label: "Rubric" },
];

// Matches the academy_gradebook_assignments_assignment_type_check DB constraint.
const ASSIGNMENT_TYPE_OPTIONS = [
  { value: "essay", label: "Essay" },
  { value: "quiz", label: "Quiz" },
  { value: "project", label: "Project" },
  { value: "participation", label: "Participation" },
  { value: "attendance", label: "Attendance" },
  { value: "practical", label: "Practical" },
  { value: "reflection", label: "Reflection" },
];

export function NewAssignmentForm({ sectionId }: NewAssignmentFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    defaultValues: { gradingType: "points", assignmentType: "quiz", maxPoints: 100, weight: 0 },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch(`/api/academy/sections/${sectionId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description || undefined,
          dueDate: data.dueDate || undefined,
          maxPoints: data.maxPoints,
          weight: data.weight,
          gradingType: data.gradingType,
          assignmentType: data.assignmentType,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to create assignment.");
      }

      notifyAcademy({
        tone: "success",
        title: "Assignment created",
        message: "Assignment successfully created.",
      });
      router.push(`/faculty/gradebook/${sectionId}`);
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Creation failed",
        message: error instanceof Error ? error.message : "Failed to create assignment.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="title" className="text-right">Title</Label>
        <div className="col-span-3">
          <Input id="title" {...register("title", { required: true })} placeholder="Midterm Examination" />
          {errors.title && <p className="text-sm text-destructive mt-1">Title is required.</p>}
        </div>
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="description" className="text-right">Description</Label>
        <div className="col-span-3">
          <Textarea id="description" {...register("description")} placeholder="Optional assignment description..." rows={3} />
        </div>
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="gradingType" className="text-right">Grading Type</Label>
        <div className="col-span-3">
          <Controller
            name="gradingType"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select id="gradingType" value={field.value} onChange={field.onChange} data={GRADING_TYPE_OPTIONS} />
            )}
          />
          {errors.gradingType && <p className="text-sm text-destructive mt-1">Grading type is required.</p>}
        </div>
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="assignmentType" className="text-right">Assignment Type</Label>
        <div className="col-span-3">
          <Controller
            name="assignmentType"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select id="assignmentType" value={field.value} onChange={field.onChange} data={ASSIGNMENT_TYPE_OPTIONS} />
            )}
          />
          {errors.assignmentType && <p className="text-sm text-destructive mt-1">Assignment type is required.</p>}
        </div>
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="maxPoints" className="text-right">Max Points</Label>
        <div className="col-span-3">
          <Input
            id="maxPoints"
            type="number"
            {...register("maxPoints", { required: true, valueAsNumber: true, min: 1 })}
            min="1"
          />
          {errors.maxPoints && <p className="text-sm text-destructive mt-1">Max points must be a positive number.</p>}
        </div>
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="weight" className="text-right">Weight (%)</Label>
        <div className="col-span-3">
          <Input
            id="weight"
            type="number"
            {...register("weight", { required: true, valueAsNumber: true, min: 0, max: 100 })}
            min="0"
            max="100"
          />
          {errors.weight && <p className="text-sm text-destructive mt-1">Weight must be between 0 and 100.</p>}
        </div>
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="dueDate" className="text-right">Due Date</Label>
        <div className="col-span-3">
          <Input id="dueDate" type="date" {...register("dueDate")} />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Assignment"}
        </Button>
      </div>
    </form>
  );
}
