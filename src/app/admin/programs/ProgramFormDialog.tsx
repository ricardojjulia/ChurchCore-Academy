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
import type { AcademicProgram } from "@/modules/academic-programs/types";

interface ProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  program?: AcademicProgram;
}

type FormData = {
  title: string;
  programCode: string;
  shortTitle: string;
  credentialType: string;
  institutionMode: string;
  gradeBand: string;
  requiredCredits: number;
  requiredClockHours: number;
  description: string;
};

const CREDENTIAL_TYPE_OPTIONS = [
  { value: "certificate", label: "Certificate" },
  { value: "diploma", label: "Diploma" },
  { value: "associate", label: "Associate Degree" },
  { value: "bachelor", label: "Bachelor's Degree" },
  { value: "master", label: "Master's Degree" },
  { value: "doctorate", label: "Doctorate" },
  { value: "non_credit", label: "Non-Credit" },
  { value: "continuing_ed", label: "Continuing Education" },
];

const INSTITUTION_MODE_OPTIONS = [
  { value: "bible_school", label: "Bible School" },
  { value: "childrens_school", label: "Children's School" },
  { value: "seminary", label: "Seminary" },
  { value: "bible_college", label: "Bible College" },
  { value: "christian_university", label: "Christian University" },
];

const GRADE_BAND_OPTIONS = [
  { value: "", label: "None" },
  { value: "early_childhood", label: "Early Childhood" },
  { value: "elementary", label: "Elementary" },
  { value: "middle_school", label: "Middle School" },
  { value: "high_school", label: "High School" },
  { value: "post_secondary", label: "Post-Secondary" },
];

export function ProgramFormDialog({ open, onOpenChange, mode, program }: ProgramFormDialogProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (mode === "edit" && program) {
      reset({
        title: program.title,
        programCode: program.programCode,
        shortTitle: program.shortTitle ?? "",
        credentialType: program.credentialType,
        institutionMode: program.institutionMode,
        gradeBand: program.gradeBand ?? "",
        requiredCredits: program.requiredCredits ?? 0,
        requiredClockHours: program.requiredClockHours ?? 0,
        description: program.description ?? "",
      });
    } else if (mode === "create") {
      reset({
        title: "",
        programCode: "",
        shortTitle: "",
        credentialType: "certificate",
        institutionMode: "bible_school",
        gradeBand: "",
        requiredCredits: 0,
        requiredClockHours: 0,
        description: "",
      });
    }
  }, [mode, program, open, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        title: data.title,
        code: data.programCode.toUpperCase(),
        shortTitle: data.shortTitle || undefined,
        credentialType: data.credentialType,
        institutionMode: data.institutionMode,
        gradeBand: data.gradeBand || undefined,
        requiredCredits: data.requiredCredits || undefined,
        requiredClockHours: data.requiredClockHours || undefined,
        description: data.description || undefined,
      };

      const url = mode === "create" ? "/api/academy/programs" : `/api/academy/programs/${program?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? `Failed to ${mode} program.`);
      }

      notifyAcademy({
        tone: "success",
        title: mode === "create" ? "Program created" : "Program updated",
        message: `Program successfully ${mode === "create" ? "created" : "updated"}.`,
      });

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: mode === "create" ? "Creation failed" : "Update failed",
        message: error instanceof Error ? error.message : `Failed to ${mode} program.`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create New Program" : "Edit Program"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Define a new academic program with credential requirements."
              : "Update the program configuration. Program code cannot be changed if students are enrolled."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} id="program-form" className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Program Name</Label>
            <Input
              id="title"
              {...register("title", { required: true })}
              className="col-span-3"
              placeholder="Bachelor of Theology"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="programCode" className="text-right">Program Code</Label>
            <Input
              id="programCode"
              {...register("programCode", { required: true })}
              className="col-span-3 font-mono"
              placeholder="BTHEO"
              onBlur={(e) => {
                e.target.value = e.target.value.toUpperCase();
              }}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="shortTitle" className="text-right">Short Title</Label>
            <Input
              id="shortTitle"
              {...register("shortTitle")}
              className="col-span-3"
              placeholder="B.Th."
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="credentialType" className="text-right">Credential Type</Label>
            <div className="col-span-3">
              <Controller
                name="credentialType"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="credentialType"
                    value={field.value}
                    onChange={field.onChange}
                    data={CREDENTIAL_TYPE_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="institutionMode" className="text-right">Institution Mode</Label>
            <div className="col-span-3">
              <Controller
                name="institutionMode"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="institutionMode"
                    value={field.value}
                    onChange={field.onChange}
                    data={INSTITUTION_MODE_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gradeBand" className="text-right">Grade Band</Label>
            <div className="col-span-3">
              <Controller
                name="gradeBand"
                control={control}
                render={({ field }) => (
                  <Select
                    id="gradeBand"
                    value={field.value}
                    onChange={field.onChange}
                    data={GRADE_BAND_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="requiredCredits" className="text-right">Required Credits</Label>
            <Input
              id="requiredCredits"
              type="number"
              {...register("requiredCredits", { valueAsNumber: true })}
              className="col-span-3"
              min="0"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="requiredClockHours" className="text-right">Required Clock Hours</Label>
            <Input
              id="requiredClockHours"
              type="number"
              {...register("requiredClockHours", { valueAsNumber: true })}
              className="col-span-3"
              min="0"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              className="col-span-3"
              placeholder="Program description..."
              rows={3}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="program-form" disabled={isSubmitting}>
            {isSubmitting ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Program" : "Save Changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
