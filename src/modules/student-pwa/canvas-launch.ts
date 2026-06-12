import { AcademyActor } from "@/modules/academy-auth/policy";
import { createCanvasLaunchResponse, CanvasLaunchConfiguration } from "@/modules/lms-contract/canvas-launch";
import { resolveTenantLmsProvider } from "@/modules/lms-contract/tenant-provider-selection";
import { PeopleConfiguration } from "@/modules/people/types";
import { resolveStudentPwaAccess } from "./student-access";

export interface CreateStudentCanvasLaunchResponseInput {
  actor: AcademyActor;
  people: PeopleConfiguration;
  configuration?: CanvasLaunchConfiguration;
  targetStudentPersonId: string;
  redirectPath: string;
  nonce: string;
  correlationId: string;
  now?: string;
  courseId?: string;
  sectionId?: string;
}

export function createStudentCanvasLaunchResponse(input: CreateStudentCanvasLaunchResponseInput) {
  const access = resolveStudentPwaAccess(input.actor, input.people, input.targetStudentPersonId, input.now?.slice(0, 10));
  const resolvedProvider = resolveTenantLmsProvider(input.people.institutionProfile, {
    tenantId: input.actor.tenantId,
    correlationId: input.correlationId,
  });

  return createCanvasLaunchResponse({
    resolvedProvider,
    configuration: input.configuration,
    request: {
      tenant: resolvedProvider.tenant,
      actor: {
        personId: input.actor.userId,
        role: input.actor.roles[0] ?? access.accessMode,
        auditActorId: `actor:${input.actor.userId}`,
        studentPersonId: access.studentProfile.personId,
      },
      courseId: input.courseId,
      sectionId: input.sectionId,
      targetStudentPersonId: input.targetStudentPersonId,
      redirectPath: input.redirectPath,
      nonce: input.nonce,
    },
    now: input.now,
  });
}
