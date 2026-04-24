import { AcademyDataset, CourseSection, FacultyRecord, Program, StudentRecord } from "@/modules/academy-data/types";
import { AiSignalRecord } from "@/modules/shepherd-ai/types";

function daysOpen(fromIso: string, toIso: string) {
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / dayMs);
}

function createSignalId(prefix: string, entityId: string) {
  return `signal-${prefix}-${entityId}`;
}

function findProgram(dataset: AcademyDataset, programId?: string): Program | undefined {
  return dataset.programs.find((program) => program.id === programId);
}

export class SignalAggregator {
  evaluate(dataset: AcademyDataset): AiSignalRecord[] {
    return [
      ...dataset.students.flatMap((student) => this.evaluateStudent(dataset, student)),
      ...dataset.faculty.flatMap((faculty) => this.evaluateFaculty(dataset, faculty)),
      ...dataset.sections.flatMap((section) => this.evaluateSection(dataset, section)),
    ];
  }

  private evaluateStudent(dataset: AcademyDataset, student: StudentRecord): AiSignalRecord[] {
    const signals: AiSignalRecord[] = [];
    const program = findProgram(dataset, student.programId);
    const now = dataset.generatedAt;

    if (student.applicationStartedAt) {
      const openDays = daysOpen(student.applicationStartedAt, now);
      if (
        student.enrollmentStatus !== "active" &&
        (openDays >= dataset.thresholds.incompleteEnrollmentDays || student.missingEnrollmentSteps.length > 0 || !student.advisorUserId)
      ) {
        signals.push({
          id: createSignalId("enrollment", student.id),
          tenantId: dataset.tenantId,
          productArea: "academy",
          entityType: "student",
          entityId: student.id,
          signalType: "enrollment_pending_beyond_threshold",
          signalValue: openDays + student.missingEnrollmentSteps.length,
          signalWindow: `${openDays}d`,
          signalPayloadJson: {
            openDays,
            missingEnrollmentSteps: student.missingEnrollmentSteps,
            advisorAssigned: Boolean(student.advisorUserId),
            programAssigned: Boolean(student.programId),
          },
          detectedAt: now,
        });
      }
    }

    if (student.missingDocuments.length > 0) {
      signals.push({
        id: createSignalId("docs", student.id),
        tenantId: dataset.tenantId,
        productArea: "academy",
        entityType: "student",
        entityId: student.id,
        signalType: "required_document_missing",
        signalValue: student.missingDocuments.length,
        signalWindow: "current-term",
        signalPayloadJson: {
          missingDocuments: student.missingDocuments,
          documentationNotes: student.documentationNotes,
        },
        detectedAt: now,
      });
    }

    if (program) {
      const completionRatio = student.creditsEarned / program.requiredCredits;
      if (completionRatio >= dataset.thresholds.graduationCreditThreshold || student.allProgramCoursesCompleted) {
        signals.push({
          id: createSignalId("graduation", student.id),
          tenantId: dataset.tenantId,
          productArea: "academy",
          entityType: "student",
          entityId: student.id,
          signalType: "graduation_threshold_near",
          signalValue: Math.round(completionRatio * 100),
          signalWindow: "degree-audit",
          signalPayloadJson: {
            programName: program.name,
            completionRatio,
            creditsEarned: student.creditsEarned,
            requiredCredits: program.requiredCredits,
            allProgramCoursesCompleted: student.allProgramCoursesCompleted,
            graduationAdministrativeHolds: student.graduationAdministrativeHolds,
          },
          detectedAt: now,
        });
      }

      const creditGap = student.expectedCreditsByNow - student.creditsEarned;
      if (
        creditGap >= dataset.thresholds.creditPaceGap ||
        (student.gpa !== undefined && student.gpa < dataset.thresholds.minimumGpa) ||
        !student.expectedNextTermRegistered
      ) {
        signals.push({
          id: createSignalId("progress", student.id),
          tenantId: dataset.tenantId,
          productArea: "academy",
          entityType: "student",
          entityId: student.id,
          signalType: "credit_progress_gap",
          signalValue: Math.max(creditGap, 0),
          signalWindow: "academic-year",
          signalPayloadJson: {
            creditGap,
            expectedCreditsByNow: student.expectedCreditsByNow,
            creditsEarned: student.creditsEarned,
            gpa: student.gpa,
            expectedNextTermRegistered: student.expectedNextTermRegistered,
            statusFlag: student.statusFlag,
          },
          detectedAt: now,
        });
      }
    }

    if (student.transcriptAlerts.length > 0 || student.recordAlerts.length > 0 || student.transcriptCredits !== student.creditsEarned) {
      signals.push({
        id: createSignalId("records", student.id),
        tenantId: dataset.tenantId,
        productArea: "academy",
        entityType: "student",
        entityId: student.id,
        signalType: "transcript_inconsistency_possible",
        signalValue: student.transcriptAlerts.length + student.recordAlerts.length + Math.abs(student.transcriptCredits - student.creditsEarned),
        signalWindow: "current-audit",
        signalPayloadJson: {
          transcriptAlerts: student.transcriptAlerts,
          recordAlerts: student.recordAlerts,
          transcriptCredits: student.transcriptCredits,
          programCredits: student.creditsEarned,
        },
        detectedAt: now,
      });
    }

    return signals;
  }

  private evaluateFaculty(dataset: AcademyDataset, faculty: FacultyRecord): AiSignalRecord[] {
    const signals: AiSignalRecord[] = [];

    if (
      faculty.assignedSectionIds.length > dataset.thresholds.facultyLoadThreshold ||
      faculty.adviseeCount > dataset.thresholds.advisorStudentRatioThreshold
    ) {
      signals.push({
        id: createSignalId("faculty-load", faculty.id),
        tenantId: dataset.tenantId,
        productArea: "academy",
        entityType: "faculty",
        entityId: faculty.id,
        signalType: "faculty_course_assignment_imbalance",
        signalValue: faculty.assignedSectionIds.length + faculty.adviseeCount,
        signalWindow: "current-term",
        signalPayloadJson: {
          assignedSectionIds: faculty.assignedSectionIds,
          adviseeCount: faculty.adviseeCount,
        },
        detectedAt: dataset.generatedAt,
      });
    }

    return signals;
  }

  private evaluateSection(dataset: AcademyDataset, section: CourseSection): AiSignalRecord[] {
    if (
      !section.instructorFacultyId ||
      section.rosterCount > section.rosterCapacity ||
      section.setupAlerts.length > 0
    ) {
      return [
        {
          id: createSignalId("section-setup", section.id),
          tenantId: dataset.tenantId,
          productArea: "academy",
          entityType: "course_section",
          entityId: section.id,
          signalType: section.instructorFacultyId ? "faculty_course_assignment_imbalance" : "course_without_instructor",
          signalValue: section.rosterCount - section.rosterCapacity + section.setupAlerts.length + (section.instructorFacultyId ? 0 : 1),
          signalWindow: "current-term",
          signalPayloadJson: {
            instructorAssigned: Boolean(section.instructorFacultyId),
            rosterCount: section.rosterCount,
            rosterCapacity: section.rosterCapacity,
            setupAlerts: section.setupAlerts,
          },
          detectedAt: dataset.generatedAt,
        },
      ];
    }

    return [];
  }
}
