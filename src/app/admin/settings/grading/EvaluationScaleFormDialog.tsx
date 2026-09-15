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
import { Select } from "@/components/ui/select";
import type { EvaluationScale, EvaluationType, OfficialRecordType, GradingStatus } from "@/modules/grading-records/types";

interface EvaluationScaleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  scale?: EvaluationScale;
}

type FormData = {
  name: string;
  scaleType: EvaluationType;
  appliesToRecordType: OfficialRecordType;
  narrativeRequired: boolean;
  status: GradingStatus;
};

const SCALE_TYPE_OPTIONS = [
  { value: "letter_grade", label: "Letter Grade" },
  { value: "numeric_percentage", label: "Numeric Percentage" },
  { value: "pass_fail", label: "Pass/Fail" },
  { value: "completion", label: "Completion" },
  { value: "competency", label: "Competency" },
  { value: "narrative", label: "Narrative" },
  { value: "attendance_only", label: "Attendance Only" },
  { value: "custom", label: "Custom" },
];

const RECORD_TYPE_OPTIONS = [
  { value: "transcript", label: "Transcript" },
  { value: "progress_record", label: "Progress Record" },
  { value: "completion_record", label: "Completion Record" },
  { value: "report_card", label: "Report Card" },
  { value: "competency_record", label: "Competency Record" },
  { value: "attendance_record", label: "Attendance Record" },
  { value: "graduation_audit", label: "Graduation Audit" },
  { value: "custom", label: "Custom" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export function EvaluationScaleFormDialog({ open, onOpenChange, mode, scale }: EvaluationScaleFormDialogProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (mode === "edit" && scale) {
      reset({
        name: scale.name,
        scaleType: scale.scaleType,
        appliesToRecordType: scale.appliesToRecordType,
        narrativeRequired: scale.narrativeRequired ?? false,
        status: scale.status,
      });
    } else if (mode === "create") {
      reset({
        name: "",
        scaleType: "letter_grade",
        appliesToRecordType: "transcript",
        narrativeRequired: false,
        status: "active",
      });
    }
  }, [mode, scale, open, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        name: data.name,
        scaleType: data.scaleType,
        appliesToRecordType: data.appliesToRecordType,
        narrativeRequired: data.narrativeRequired,
        status: data.status,
      };

      const url = mode === "create" ? "/api/academy/config/grading/scales" : `/api/academy/config/grading/scales/${scale?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? `Failed to ${mode} evaluation scale.`);
      }

      notifyAcademy({
        tone: "success",
        title: mode === "create" ? "Evaluation scale created" : "Evaluation scale updated",
        message: `Evaluation scale successfully ${mode === "create" ? "created" : "updated"}.`,
      });

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: mode === "create" ? "Creation failed" : "Update failed",
        message: error instanceof Error ? error.message : `Failed to ${mode} evaluation scale.`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Evaluation Scale" : "Edit Evaluation Scale"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Define a new evaluation scale with bands."
              : "Update the evaluation scale configuration."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} id="scale-form" className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Scale Name</Label>
            <Input
              id="name"
              {...register("name", { required: true })}
              className="col-span-3"
              placeholder="Standard Letter Grade Scale"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="scaleType" className="text-right">Scale Type</Label>
            <div className="col-span-3">
              <Controller
                name="scaleType"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="scaleType"
                    value={field.value}
                    onChange={field.onChange}
                    data={SCALE_TYPE_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="appliesToRecordType" className="text-right">Record Type</Label>
            <div className="col-span-3">
              <Controller
                name="appliesToRecordType"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="appliesToRecordType"
                    value={field.value}
                    onChange={field.onChange}
                    data={RECORD_TYPE_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="narrativeRequired" className="text-right">Narrative Required</Label>
            <div className="col-span-3 flex items-center">
              <input
                type="checkbox"
                id="narrativeRequired"
                {...register("narrativeRequired")}
                className="h-4 w-4 rounded border-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">Status</Label>
            <div className="col-span-3">
              <Controller
                name="status"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="status"
                    value={field.value}
                    onChange={field.onChange}
                    data={STATUS_OPTIONS}
                  />
                )}
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="scale-form" disabled={isSubmitting}>
            {isSubmitting ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Scale" : "Save Changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
