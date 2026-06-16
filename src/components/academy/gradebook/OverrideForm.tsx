"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { overrideGradeAction } from "@/lib/actions/gradebook/overrideGradeAction";
import {
  overrideGradeSchema,
  type OverrideGradeInput,
} from "@/lib/gradebook/schemas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function OverrideForm({
  gradeRecordId,
  action = overrideGradeAction,
}: {
  gradeRecordId: string;
  action?: typeof overrideGradeAction;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<OverrideGradeInput>({
    resolver: zodResolver(overrideGradeSchema),
    defaultValues: {
      gradeRecordId,
      pointsEarned: 0,
      reason: "",
    },
  });

  function submitOverride() {
    startTransition(async () => {
      await action(form.getValues());
    });
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-2">
        <Label htmlFor="overridePointsEarned">Adjusted points</Label>
        <Input
          id="overridePointsEarned"
          type="number"
          min="0"
          step="0.01"
          {...form.register("pointsEarned", { valueAsNumber: true })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="overrideReason">Reason for adjustment</Label>
        <Textarea id="overrideReason" {...form.register("reason")} />
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" loading={pending}>
            Override grade
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm grade override</AlertDialogTitle>
            <AlertDialogDescription>
              This writes an immutable audit record. Continue only when the adjustment
              and reason are ready for review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitOverride}>Confirm override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
