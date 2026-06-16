import type { GradeRecord } from "@/types/gradebook";
import { GrowthFramedGrade } from "@/components/academy/gradebook/GrowthFramedGrade";

export function GradeDisplayCard({ record }: { record: GradeRecord }) {
  return (
    <GrowthFramedGrade
      assignmentTitle={record.assignmentTitle}
      percentage={record.percentage}
      letterGrade={record.letterGrade}
      isPassing={record.isPassing}
      instructorFeedback={record.instructorFeedback}
      sensitivityTier={record.sensitivityTier}
    />
  );
}
