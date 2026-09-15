"use client";

import { useState } from "react";
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

interface CreatePeriodDialogProps {
  yearId: string;
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

export function CreatePeriodDialog({ yearId, open, onOpenChange, onSuccess }: CreatePeriodDialogProps) {
  const [warnings, setWarnings] = useState<OverlapWarning[]>([]);
  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      periodType: "semester",
      sequence: 1,
    },
  });

  function handleClose() {
    const hadWarnings = warnings.length > 0;
    reset();
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
      const res = await fetch(`/api/academy/calendar/years/${yearId}/periods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to create period.");
      }

      const result = await res.json() as { period: unknown; warnings?: OverlapWarning[] };

      if (result.warnings && result.warnings.length > 0) {
        setWarnings(result.warnings);
        notifyAcademy({
          tone: "warning",
          title: "Period created with warnings",
          message: "The period was created but has date overlaps. Review the warnings below.",
        });
        // Don't close immediately — let user acknowledge the warning
      } else {
        notifyAcademy({
          tone: "success",
          title: "Period created",
          message: "Academic period successfully created.",
        });
        reset();
        setWarnings([]);
        onSuccess();
      }
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Creation failed",
        message: error instanceof Error ? error.message : "Failed to create period.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Academic Period</DialogTitle>
          <DialogDescription>Define a term, semester, or module for this academic year.</DialogDescription>
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

        <form onSubmit={handleSubmit(onSubmit)} id="create-period-form" className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" {...register("name", { required: true })} className="col-span-3" placeholder="Fall 2026" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">Code</Label>
            <Input
              id="code"
              {...register("code", { required: true })}
              className="col-span-3 font-mono"
              placeholder="FALL2026"
              onBlur={(e) => {
                e.target.value = e.target.value.toUpperCase();
              }}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="periodType" className="text-right">Period Type</Label>
            <div className="col-span-3">
              <Controller
                name="periodType"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="periodType"
                    value={field.value}
                    onChange={field.onChange}
                    data={PERIOD_TYPE_OPTIONS}
                  />
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startsOn" className="text-right">Start Date</Label>
            <Input id="startsOn" type="date" {...register("startsOn", { required: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endsOn" className="text-right">End Date</Label>
            <Input id="endsOn" type="date" {...register("endsOn", { required: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sequence" className="text-right">Sequence</Label>
            <Input id="sequence" type="number" {...register("sequence", { required: true, valueAsNumber: true })} className="col-span-3" min="1" />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {warnings.length > 0 ? "Close" : "Cancel"}
          </Button>
          {warnings.length === 0 && (
            <Button type="submit" form="create-period-form" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Period"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
