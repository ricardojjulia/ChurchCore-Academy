"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { notifyAcademy } from "@/lib/ui/notifications";
import { AlertCircle } from "lucide-react";
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
import type { AcademicPeriod } from "@/modules/academic-calendar/types";

interface EditPeriodDialogProps {
  yearId: string;
  period: AcademicPeriod;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type FormData = {
  name: string;
  code: string;
  periodType: string;
  startsOn: string;
  endsOn: string;
  sequence: number;
};

interface OverlapWarning {
  type: string;
  message: string;
  conflictingPeriodId?: string;
  conflictingPeriodName?: string;
}

const PERIOD_TYPE_OPTIONS = [
  { value: "semester", label: "Semester / Term" },
  { value: "quarter", label: "Quarter / Session" },
  { value: "trimester", label: "Trimester" },
  { value: "block", label: "Block" },
  { value: "module", label: "Module" },
  { value: "intensive", label: "Intensive" },
  { value: "term", label: "Term" },
];

export function EditPeriodDialog({ yearId, period, open, onOpenChange, onSuccess }: EditPeriodDialogProps) {
  const [warnings, setWarnings] = useState<OverlapWarning[]>([]);
  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (period && open) {
      reset({
        name: period.name,
        code: period.code,
        periodType: period.periodType,
        startsOn: period.startsOn,
        endsOn: period.endsOn,
        sequence: period.sequence ?? 1,
      });
    }
  }, [period, open, reset]);

  function handleClose() {
    const hadWarnings = warnings.length > 0;
    setWarnings([]);
    onOpenChange(false);
    // A warned save already persisted successfully — refresh the parent list.
    if (hadWarnings) {
      onSuccess();
    }
  }

  const onSubmit = async (data: FormData) => {
    try {
      setWarnings([]);
      const res = await fetch(`/api/academy/calendar/years/${yearId}/periods/${period.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to update period.");
      }

      const result = await res.json() as { period: unknown; warnings?: OverlapWarning[] };

      if (result.warnings && result.warnings.length > 0) {
        setWarnings(result.warnings);
        notifyAcademy({
          tone: "warning",
          title: "Period updated with warnings",
          message: "The period was updated but has date overlaps. Review the warnings below.",
        });
        // Don't close immediately — let user acknowledge the warning
      } else {
        notifyAcademy({
          tone: "success",
          title: "Period updated",
          message: "Academic period successfully updated.",
        });
        setWarnings([]);
        onSuccess();
      }
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Failed to update period.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Academic Period</DialogTitle>
          <DialogDescription>Update the period configuration. Some fields may be locked based on status and assignments.</DialogDescription>
        </DialogHeader>

        {warnings.length > 0 && (
          <div className="period-overlap-warning">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Date Overlap Detected</p>
              {warnings.map((warning, idx) => (
                <p key={idx} className="text-sm mt-1">
                  {warning.message}
                </p>
              ))}
              <p className="text-sm mt-2">The period was saved successfully. Overlapping periods are allowed — verify this is intentional.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} id="edit-period-form" className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-name" className="text-right">Name</Label>
            <Input id="edit-name" {...register("name", { required: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-code" className="text-right">Code</Label>
            <Input
              id="edit-code"
              {...register("code", { required: true })}
              className="col-span-3 font-mono"
              onBlur={(e) => {
                e.target.value = e.target.value.toUpperCase();
              }}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-periodType" className="text-right">Period Type</Label>
            <div className="col-span-3">
              <Controller
                name="periodType"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="edit-periodType"
                    value={field.value}
                    onChange={field.onChange}
                    data={PERIOD_TYPE_OPTIONS}
                  />
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-startsOn" className="text-right">Start Date</Label>
            <Input id="edit-startsOn" type="date" {...register("startsOn", { required: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-endsOn" className="text-right">End Date</Label>
            <Input id="edit-endsOn" type="date" {...register("endsOn", { required: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-sequence" className="text-right">Sequence</Label>
            <Input id="edit-sequence" type="number" {...register("sequence", { required: true, valueAsNumber: true })} className="col-span-3" min="1" />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {warnings.length > 0 ? "Close" : "Cancel"}
          </Button>
          {warnings.length === 0 && (
            <Button type="submit" form="edit-period-form" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
