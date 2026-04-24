import { AcademyDataset } from "@/modules/academy-data/types";
import { AiSignalRecord, EntityType } from "@/modules/shepherd-ai/types";

export interface AcademyContext {
  entityLabel: string;
  entityDescription: string;
  ownerRole: string;
  programName?: string;
}

function resolveEntityLabel(dataset: AcademyDataset, entityType: EntityType, entityId: string) {
  if (entityType === "student") {
    const student = dataset.students.find((item) => item.id === entityId);
    return {
      label: student?.fullName ?? entityId,
      description: student?.email ?? "Student record",
      programName: dataset.programs.find((program) => program.id === student?.programId)?.name,
    };
  }

  if (entityType === "faculty") {
    const faculty = dataset.faculty.find((item) => item.id === entityId);
    return {
      label: faculty?.name ?? entityId,
      description: faculty?.title ?? "Faculty record",
    };
  }

  if (entityType === "section") {
    const section = dataset.sections.find((item) => item.id === entityId);
    const programName = dataset.programs.find((program) => program.id === section?.programId)?.name;

    return {
      label: `${section?.code ?? entityId} · ${section?.title ?? "Section"}`,
      description: programName ?? "Course section",
    };
  }

  const program = dataset.programs.find((item) => item.id === entityId);
  return {
    label: program?.name ?? entityId,
    description: program?.cohortLabel ?? "Program",
  };
}

export class ContextBuilder {
  build(dataset: AcademyDataset, signal: AiSignalRecord): AcademyContext {
    const entity = resolveEntityLabel(dataset, signal.entityType, signal.entityId);
    const ownerRole = this.ownerRole(signal.signalType);

    return {
      entityLabel: entity.label,
      entityDescription: entity.description,
      ownerRole,
      programName: entity.programName,
    };
  }

  private ownerRole(signalType: AiSignalRecord["signalType"]) {
    switch (signalType) {
      case "incomplete_enrollment":
        return "Admissions";
      case "missing_student_documentation":
      case "transcript_records_inconsistency":
        return "Registrar";
      case "graduation_eligibility":
        return "Registrar review";
      case "academic_progress_gap":
        return "Advisor review";
      case "faculty_course_assignment_imbalance":
        return "Academic administration";
      default:
        return "Administrative review";
    }
  }
}
