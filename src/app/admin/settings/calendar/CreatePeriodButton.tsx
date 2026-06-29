"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { notifyAcademy } from "@/lib/ui/notifications";
import { PlusCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
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
import type { AcademicYear } from "@/modules/academic-calendar/types";

interface CreatePeriodButtonProps {
  academicYears: AcademicYear[];
  onSuccess: () => void;
  variant?: ButtonProps["variant"];
}

type FormData = {
  name: string;
  code: string;
  academicYearId: string;
  startsOn: string;
  endsOn: string;
};

export function CreatePeriodButton({ academicYears, onSuccess, variant = "default" }: CreatePeriodButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/academy/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, periodType: "term" }), // Assuming 'term' for now
      });

      if (!res.ok) {
        throw new Error("Failed to create period.");
      }

      notifyAcademy({
        tone: "success",
        title: "Period created",
        message: "Academic period successfully created.",
      });
      onSuccess();
      setIsOpen(false);
      reset();
    } catch (_error) {
      notifyAcademy({
        tone: "error",
        title: "Creation failed",
        message: "Failed to create period.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Period
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Academic Period</DialogTitle>
          <DialogDescription>Define a new term, semester, or module for your institution.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} id="create-period-form" className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" {...register("name", { required: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">Code</Label>
            <Input id="code" {...register("code", { required: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="academicYearId" className="text-right">Academic Year</Label>
            <div className="col-span-3">
              <Controller
                name="academicYearId"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="academicYearId"
                    placeholder="Select a year"
                    value={field.value || ""}
                    onChange={field.onChange}
                    data={academicYears.map((year) => ({
                      value: year.id,
                      label: year.name,
                    }))}
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
        </form>
        <DialogFooter>
          <Button type="submit" form="create-period-form" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Period"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
