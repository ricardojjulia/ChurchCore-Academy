"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import type { EvaluationScaleBand } from "@/modules/grading-records/types";

interface ScaleBandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  scaleId: string;
  band?: EvaluationScaleBand;
}

type FormData = {
  label: string;
  minimumValue: string;
  maximumValue: string;
  gradePoints: string;
  isPassing: boolean;
  isCompletion: boolean;
  officialRecordValue: string;
  sequence: number;
};

export function ScaleBandFormDialog({ open, onOpenChange, mode, scaleId, band }: ScaleBandFormDialogProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (mode === "edit" && band) {
      reset({
        label: band.label,
        minimumValue: band.minimumValue !== undefined ? String(band.minimumValue) : "",
        maximumValue: band.maximumValue !== undefined ? String(band.maximumValue) : "",
        gradePoints: band.gradePoints !== undefined ? String(band.gradePoints) : "",
        isPassing: band.isPassing,
        isCompletion: band.isCompletion,
        officialRecordValue: band.officialRecordValue,
        sequence: band.sequence,
      });
    } else if (mode === "create") {
      reset({
        label: "",
        minimumValue: "",
        maximumValue: "",
        gradePoints: "",
        isPassing: false,
        isCompletion: false,
        officialRecordValue: "",
        sequence: 0,
      });
    }
  }, [mode, band, open, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...(mode === "create" ? { scaleId } : {}),
        label: data.label,
        minimumValue: data.minimumValue ? parseFloat(data.minimumValue) : undefined,
        maximumValue: data.maximumValue ? parseFloat(data.maximumValue) : undefined,
        gradePoints: data.gradePoints ? parseFloat(data.gradePoints) : undefined,
        isPassing: data.isPassing,
        isCompletion: data.isCompletion,
        officialRecordValue: data.officialRecordValue,
        sequence: data.sequence,
      };

      const url = mode === "create" ? "/api/academy/config/grading/scale-bands" : `/api/academy/config/grading/scale-bands/${band?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? `Failed to ${mode} scale band.`);
      }

      notifyAcademy({
        tone: "success",
        title: mode === "create" ? "Scale band created" : "Scale band updated",
        message: `Scale band successfully ${mode === "create" ? "created" : "updated"}.`,
      });

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: mode === "create" ? "Creation failed" : "Update failed",
        message: error instanceof Error ? error.message : `Failed to ${mode} scale band.`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Scale Band" : "Edit Scale Band"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new band to this evaluation scale."
              : "Update the scale band configuration."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} id="band-form" className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="label" className="text-right">Band Label</Label>
            <Input
              id="label"
              {...register("label", { required: true })}
              className="col-span-3"
              placeholder="A"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="minimumValue" className="text-right">Minimum Value</Label>
            <Input
              id="minimumValue"
              type="number"
              step="0.01"
              {...register("minimumValue")}
              className="col-span-3"
              placeholder="90"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maximumValue" className="text-right">Maximum Value</Label>
            <Input
              id="maximumValue"
              type="number"
              step="0.01"
              {...register("maximumValue")}
              className="col-span-3"
              placeholder="100"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gradePoints" className="text-right">Grade Points</Label>
            <Input
              id="gradePoints"
              type="number"
              step="0.01"
              {...register("gradePoints")}
              className="col-span-3"
              placeholder="4.0"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isPassing" className="text-right">Is Passing</Label>
            <div className="col-span-3 flex items-center">
              <input
                type="checkbox"
                id="isPassing"
                {...register("isPassing")}
                className="h-4 w-4 rounded border-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isCompletion" className="text-right">Is Completion</Label>
            <div className="col-span-3 flex items-center">
              <input
                type="checkbox"
                id="isCompletion"
                {...register("isCompletion")}
                className="h-4 w-4 rounded border-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="officialRecordValue" className="text-right">Official Record Value</Label>
            <Input
              id="officialRecordValue"
              {...register("officialRecordValue", { required: true })}
              className="col-span-3"
              placeholder="A"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sequence" className="text-right">Sequence</Label>
            <Input
              id="sequence"
              type="number"
              {...register("sequence", { required: true, valueAsNumber: true })}
              className="col-span-3"
              placeholder="1"
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="band-form" disabled={isSubmitting}>
            {isSubmitting ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Band" : "Save Changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
