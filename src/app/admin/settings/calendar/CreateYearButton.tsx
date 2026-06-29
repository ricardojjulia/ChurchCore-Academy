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

interface CreateYearButtonProps {
  onSuccess: () => void;
  variant?: ButtonProps["variant"];
}

type FormData = {
  name: string;
  code: string;
  startsOn: string;
  endsOn: string;
  calendarSystem: string;
};

export function CreateYearButton({ onSuccess, variant = "default" }: CreateYearButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      calendarSystem: "academic_year",
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/academy/calendar/years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Failed to create academic year.");
      }

      notifyAcademy({
        tone: "success",
        title: "Academic year created",
        message: "Academic year successfully created.",
      });
      onSuccess();
      setIsOpen(false);
      reset();
    } catch (_error) {
      notifyAcademy({
        tone: "error",
        title: "Creation failed",
        message: "Failed to create academic year.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Year
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Academic Year</DialogTitle>
          <DialogDescription>Define a new high-level Academic Year container for your calendar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} id="create-year-form" className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" {...register("name", { required: true })} className="col-span-3" placeholder="e.g. Academic Year 2027-2028" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">Code</Label>
            <Input id="code" {...register("code", { required: true })} className="col-span-3" placeholder="e.g. AY2027" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="calendarSystem" className="text-right">System</Label>
            <div className="col-span-3">
              <Controller
                name="calendarSystem"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    id="calendarSystem"
                    value={field.value || ""}
                    onChange={field.onChange}
                    data={[
                      { value: "academic_year", label: "Academic Year" },
                      { value: "school_year", label: "School Year" },
                      { value: "rolling_enrollment", label: "Rolling Enrollment" },
                    ]}
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
          <Button type="submit" form="create-year-form" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Year"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
