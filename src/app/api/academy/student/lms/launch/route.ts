import { randomUUID } from "node:crypto";
import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveStudentAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyActor, assertStudentPortalAccess, assertCapability } from "@/modules/academy-auth/policy";
import { AcademyPeopleRepository } from "@/modules/people/postgres-repository";
import { PeopleConfiguration } from "@/modules/people/types";
import {
  createStudentLmsLaunchResponse,
  resolveStudentLmsLaunchRoutingOptions,
} from "@/modules/student-pwa/lms-launch-orchestration";

interface StudentLmsLaunchPeopleReader {
  fetchPeopleConfiguration(tenantId: string): Promise<PeopleConfiguration>;
}

type StudentActorResolver = (
  request: Request,
) => Promise<{ actor: AcademyActor }>;

interface LaunchRequestPayload {
  targetStudentPersonId: string;
  redirectPath: string;
  nonce: string;
  correlationId: string;
  courseId?: string;
  sectionId?: string;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function environmentValue(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function buildLaunchRequestPayload(request: Request, actorUserId: string, body: unknown): LaunchRequestPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid launch request payload.");
  }

  const payload = body as Record<string, unknown>;
  const targetStudentPersonId = optionalString(payload.targetStudentPersonId) ?? actorUserId;
  const requestedRedirectPath = optionalString(payload.redirectPath) ?? "/student/lms";
  const normalizedRedirectPath = new URL(requestedRedirectPath, "http://localhost").pathname;

  if (!normalizedRedirectPath.startsWith("/student")) {
    throw new Error("Invalid redirect path.");
  }

  return {
    targetStudentPersonId,
    redirectPath: normalizedRedirectPath,
    nonce: optionalString(payload.nonce) ?? randomUUID(),
    correlationId: optionalString(request.headers.get("x-correlation-id")) ?? `corr-student-lms-${randomUUID()}`,
    courseId: optionalString(payload.courseId),
    sectionId: optionalString(payload.sectionId),
  };
}

export async function launchStudentLmsRequest(
  request: Request,
  repository?: StudentLmsLaunchPeopleReader,
  resolveActor: StudentActorResolver = resolveStudentAcademyActorFromSession,
) {
  let actor;
  try {
    ({ actor } = await resolveActor(request));
  } catch {
    return jsonError("Authentication required.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  try {
    const launchRequest = buildLaunchRequestPayload(request, actor.userId, body);
    const createResponse = async (
      resolvedRepository: StudentLmsLaunchPeopleReader,
    ) => {
      const people = await resolvedRepository.fetchPeopleConfiguration(
        actor.tenantId,
      );
      const launch = createStudentLmsLaunchResponse({
        actor,
        people,
        ...resolveStudentLmsLaunchRoutingOptions({
          tenantId: actor.tenantId,
          moodleLaunchBaseUrl: environmentValue("MOODLE_LAUNCH_BASE_URL"),
          moodleLaunchMode: process.env.MOODLE_LAUNCH_MODE,
          canvasLaunchBaseUrl: environmentValue("CANVAS_LAUNCH_BASE_URL"),
          canvasLaunchMode: process.env.CANVAS_LAUNCH_MODE,
        }),
        ...launchRequest,
      });

      return jsonOk({ launch });
    };

    if (repository) {
      return await createResponse(repository);
    }

    return await withCapabilityContext(actor, async (client, capabilities) => {
      assertStudentPortalAccess(actor, capabilities);
      assertCapability(capabilities, "lmsLaunch");
      return createResponse(
        new AcademyPeopleRepository(asAcademyDatabase(client)),
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve student LMS launch.";

    if (message.includes("Malformed") || message.includes("Invalid")) {
      return jsonError(message, 400);
    }

    if (message.includes("Forbidden")) {
      return jsonError(message, 403);
    }

    if (message.includes("not found") || message.includes("was not found")) {
      return jsonError(message, 404);
    }

    return jsonError("Unable to resolve student LMS launch.", 500);
  }
}

export async function POST(request: Request) {
  return launchStudentLmsRequest(request);
}
