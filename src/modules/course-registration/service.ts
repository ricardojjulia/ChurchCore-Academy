import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyConflictError } from "@/modules/academy-auth/errors";
import {
  CourseSectionRegistrationEligibility,
  CourseRegistrationRepository,
  CourseRegistrationRequest,
  CourseRegistrationResult,
} from "@/modules/course-registration/types";
import { assertCourseRegistrationAccess } from "@/modules/course-registration/policy";

export class CourseRegistrationService {
  constructor(
    private readonly repository: CourseRegistrationRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async registerAndConfirm(
    actor: AcademyActor,
    input: Omit<CourseRegistrationRequest, "actorPersonId" | "confirmedAt">,
  ): Promise<CourseRegistrationResult> {
    assertCourseRegistrationAccess(actor, input.tenantId);

    const replay = await this.repository.findReplay(input.tenantId, input.idempotencyKey);
    if (replay) {
      return replay;
    }

    const admission = await this.repository.findConvertedAdmission(
      input.tenantId,
      input.applicationId,
    );

    if (!admission) {
      throw new Error(`Admission application ${input.applicationId} was not found.`);
    }

    if (admission.status !== "accepted") {
      throw new AcademyConflictError(
        "Only accepted admissions can register course sections.",
      );
    }

    if (
      !admission.studentProfileId ||
      !admission.programEnrollmentId ||
      !admission.periodRegistrationId ||
      !admission.studentPersonId
    ) {
      throw new AcademyConflictError(
        "Admission must be converted before section registration.",
      );
    }

    const confirmedAt = this.now();
    const eligibility = await this.repository.evaluateSectionEligibility({
      tenantId: input.tenantId,
      courseSectionId: input.courseSectionId,
      studentPersonId: admission.studentPersonId,
      periodRegistrationId: admission.periodRegistrationId,
      evaluatedAt: confirmedAt,
    });

    assertSectionRegistrationEligible(eligibility);

    return this.repository.createRegistration(
      {
        ...input,
        actorPersonId: actor.userId,
        confirmedAt,
      },
      {
        studentProfileId: admission.studentProfileId,
        programEnrollmentId: admission.programEnrollmentId,
        periodRegistrationId: admission.periodRegistrationId,
        studentPersonId: admission.studentPersonId,
      },
    );
  }
}

function assertSectionRegistrationEligible(
  eligibility: CourseSectionRegistrationEligibility,
) {
  const blockers: string[] = [];

  if (eligibility.status !== "open") {
    blockers.push(`section is ${eligibility.status}`);
  }

  if (eligibility.hasActiveRegistrationForStudent) {
    blockers.push("student already has an active registration for this course section");
  }

  if (!eligibility.registrationWindowOpen) {
    blockers.push("registration window is not open");
  }

  if (
    eligibility.capacity !== null &&
    eligibility.activeRegistrationCount >= eligibility.capacity
  ) {
    blockers.push("section capacity is full");
  }

  if (eligibility.unmetPrerequisites.length > 0) {
    blockers.push(
      `unmet prerequisites: ${eligibility.unmetPrerequisites.join(", ")}`,
    );
  }

  if (eligibility.activeHolds.length > 0) {
    blockers.push(`active holds: ${eligibility.activeHolds.join(", ")}`);
  }

  if (blockers.length > 0) {
    throw new AcademyConflictError(
      `Course section registration is blocked because ${blockers.join("; ")}.`,
    );
  }
}
