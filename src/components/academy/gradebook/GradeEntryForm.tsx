"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { submitGradeAction } from "@/lib/actions/gradebook/submitGradeAction";
import {
  submitGradeSchema,
  type SubmitGradeInput,
} from "@/lib/gradebook/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function GradeEntryForm({
  defaultValues,
  action = submitGradeAction,
}: {
  defaultValues: Pick<
    SubmitGradeInput,
    "submissionId" | "assignmentId" | "learnerPersonId" | "maxPoints"
  >;
  action?: typeof submitGradeAction;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<SubmitGradeInput>({
    resolver: zodResolver(submitGradeSchema),
    defaultValues: {
      ...defaultValues,
      pointsEarned: 0,
      letterGrade: null,
      isPassing: null,
      instructorFeedback: null,
      sensitivityTier: "standard",
    },
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        startTransition(async () => {
          await action(values);
        });
      })}
    >
      <div className="grid gap-2">
        <Label htmlFor="pointsEarned">Points earned</Label>
        <Input
          id="pointsEarned"
          type="number"
          min="0"
          step="0.01"
          {...form.register("pointsEarned", { valueAsNumber: true })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="letterGrade">Letter grade</Label>
        <Input id="letterGrade" {...form.register("letterGrade")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="instructorFeedback">Instructor feedback</Label>
        <Textarea id="instructorFeedback" {...form.register("instructorFeedback")} />
      </div>
      <Button type="submit" loading={pending}>
        Submit grade
      </Button>
    </form>
  );
}
