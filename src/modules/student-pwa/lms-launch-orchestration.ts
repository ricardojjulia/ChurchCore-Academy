import { AcademyActor } from "@/modules/academy-auth/policy";
import { noLmsProvider } from "@/modules/lms-contract/no-lms-provider";
import { CanvasLaunchConfiguration } from "@/modules/lms-contract/canvas-launch";
import { MoodleLaunchConfiguration } from "@/modules/lms-contract/moodle-launch";
import { resolveTenantLmsProvider } from "@/modules/lms-contract/tenant-provider-selection";
import { PeopleConfiguration } from "@/modules/people/types";
import { createStudentCanvasLaunchResponse } from "./canvas-launch";
import { createStudentMoodleLaunchResponse } from "./moodle-launch";
import { resolveStudentPwaAccess } from "./student-access";

export interface StudentLmsLaunchRoutingOptions {
  moodleConfiguration?: MoodleLaunchConfiguration;
  canvasConfiguration?: CanvasLaunchConfiguration;
}

export interface CreateStudentLmsLaunchResponseInput extends StudentLmsLaunchRoutingOptions {
  actor: AcademyActor;
  people: PeopleConfiguration;
  targetStudentPersonId: string;
  redirectPath: string;
  nonce: string;
  correlationId: string;
  now?: string;
  courseId?: string;
  sectionId?: string;
}

export function createStudentLmsLaunchResponse(input: CreateStudentLmsLaunchResponseInput) {
  // Validate student/guardian scope before selecting the tenant provider bridge.
  const access = resolveStudentPwaAccess(input.actor, input.people, input.targetStudentPersonId, input.now?.slice(0, 10));
  const resolvedProvider = resolveTenantLmsProvider(input.people.institutionProfile, {
    tenantId: input.actor.tenantId,
    correlationId: input.correlationId,
  });

  if (resolvedProvider.tenant.providerId === "moodle") {
    return createStudentMoodleLaunchResponse({
      actor: input.actor,
      people: input.people,
      configuration: input.moodleConfiguration,
      targetStudentPersonId: input.targetStudentPersonId,
      redirectPath: input.redirectPath,
      nonce: input.nonce,
      correlationId: input.correlationId,
      now: input.now,
      courseId: input.courseId,
      sectionId: input.sectionId,
    });
  }

  if (resolvedProvider.tenant.providerId === "canvas") {
    return createStudentCanvasLaunchResponse({
      actor: input.actor,
      people: input.people,
      configuration: input.canvasConfiguration,
      targetStudentPersonId: input.targetStudentPersonId,
      redirectPath: input.redirectPath,
      nonce: input.nonce,
      correlationId: input.correlationId,
      now: input.now,
      courseId: input.courseId,
      sectionId: input.sectionId,
    });
  }

  return noLmsProvider.createLaunchResponse({
    tenant: resolvedProvider.tenant,
    actor: {
      personId: input.actor.userId,
      role: input.actor.roles[0] ?? access.accessMode,
      auditActorId: `actor:${input.actor.userId}`,
      studentPersonId: access.studentProfile.personId,
    },
    targetStudentPersonId: input.targetStudentPersonId,
    redirectPath: input.redirectPath,
    nonce: input.nonce,
    courseId: input.courseId,
    sectionId: input.sectionId,
  });
}

interface StudentLmsLaunchRoutingOptionsInput {
  tenantId: string;
  moodleLaunchBaseUrl?: string;
  moodleLaunchMode?: string;
  canvasLaunchBaseUrl?: string;
  canvasLaunchMode?: string;
}

function trimmedOptional(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function resolveStudentLmsLaunchRoutingOptions(input: StudentLmsLaunchRoutingOptionsInput): StudentLmsLaunchRoutingOptions {
  const moodleLaunchBaseUrl = trimmedOptional(input.moodleLaunchBaseUrl);
  const canvasLaunchBaseUrl = trimmedOptional(input.canvasLaunchBaseUrl);

  return {
    moodleConfiguration: moodleLaunchBaseUrl
      ? {
          tenantId: input.tenantId,
          launchMode: input.moodleLaunchMode === "lti" ? "lti" : "oidc",
          launchBaseUrl: moodleLaunchBaseUrl,
          displayLabel: "Moodle",
        }
      : undefined,
    canvasConfiguration: canvasLaunchBaseUrl
      ? {
          tenantId: input.tenantId,
          launchMode: input.canvasLaunchMode === "lti" ? "lti" : "oauth2",
          launchBaseUrl: canvasLaunchBaseUrl,
          displayLabel: "Canvas",
        }
      : undefined,
  };
}
