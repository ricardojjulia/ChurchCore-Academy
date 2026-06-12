import { randomUUID } from "node:crypto";
import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { resolveStudentAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyPeopleRepository } from "@/modules/people/postgres-repository";
import { PeopleConfiguration } from "@/modules/people/types";
import {
  createStudentLmsLaunchResponse,
  resolveStudentLmsLaunchRoutingOptionsFromEnvironment,
} from "@/modules/student-pwa/lms-launch-orchestration";

interface StudentLmsLaunchPeopleReader {
  fetchPeopleConfiguration(tenantId: string): Promise<PeopleConfiguration>;
}

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

function buildLaunchRequestPayload(request: Request, actorUserId: string, body: unknown): LaunchRequestPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid launch request payload.");
  }

  const payload = body as Record<string, unknown>;
  const targetStudentPersonId = optionalString(payload.targetStudentPersonId) ?? actorUserId;
  const redirectPath = optionalString(payload.redirectPath) ?? "/student/lms";

  if (!redirectPath.startsWith("/student")) {
    throw new Error("Invalid redirect path.");
  }

  return {
    targetStudentPersonId,
    redirectPath,
    nonce: optionalString(payload.nonce) ?? randomUUID(),
    correlationId: optionalString(request.headers.get("x-correlation-id")) ?? `corr-student-lms-${randomUUID()}`,
    courseId: optionalString(payload.courseId),
    sectionId: optionalString(payload.sectionId),
  };
}

export async function launchStudentLmsRequest(
  request: Request,
  repository: StudentLmsLaunchPeopleReader = new AcademyPeopleRepository(),
) {
  const { actor } = await resolveStudentAcademyActorFromSession(request.headers);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  try {
    const launchRequest = buildLaunchRequestPayload(request, actor.userId, body);
    const people = await repository.fetchPeopleConfiguration(actor.tenantId);
    const launch = createStudentLmsLaunchResponse({
      actor,
      people,
      ...resolveStudentLmsLaunchRoutingOptionsFromEnvironment(actor.tenantId),
      ...launchRequest,
    });

    return jsonOk({ launch });
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
