import { z } from "zod";

export const submitGradeSchema = z.object({
  submissionId: z.uuid(),
  assignmentId: z.uuid(),
  learnerPersonId: z.string().min(1),
  pointsEarned: z.number().min(0),
  maxPoints: z.number().positive(),
  letterGrade: z.string().trim().max(8).nullable().optional(),
  isPassing: z.boolean().nullable().optional(),
  instructorFeedback: z.string().trim().max(4000).nullable().optional(),
  sensitivityTier: z.enum(["standard", "elevated", "pastoral"]),
});

export type SubmitGradeInput = z.infer<typeof submitGradeSchema>;

export const overrideGradeSchema = z.object({
  gradeRecordId: z.uuid(),
  pointsEarned: z.number().min(0),
  reason: z.string().trim().min(12).max(4000),
});

export type OverrideGradeInput = z.infer<typeof overrideGradeSchema>;
