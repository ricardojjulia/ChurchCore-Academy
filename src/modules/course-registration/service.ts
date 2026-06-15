import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyConflictError } from "@/modules/academy-auth/errors";
import {
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

    return this.repository.createRegistration(
      {
        ...input,
        actorPersonId: actor.userId,
        confirmedAt: this.now(),
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
