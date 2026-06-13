import { createClient } from "@/lib/supabase/server";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { PostgresAcademyIdentityRepository } from "@/modules/academy-auth/postgres-identity-repository";
import { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import {
  AcademyIdentityRepository,
  resolveAcademyIdentity,
} from "@/modules/academy-auth/session-resolver";

const allowedRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
  "advisor",
  "faculty",
  "teacher",
  "professor",
  "student",
  "guardian",
]);

function parseBootstrapRoles(value: string | null): AcademyRole[] {
  return (
    value
      ?.split(",")
      .map((role) => role.trim())
      .filter((role): role is AcademyRole =>
        allowedRoles.has(role as AcademyRole),
      ) ?? []
  );
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function canUseLocalAcademyBootstrap(
  requestUrl: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (
    environment.NODE_ENV === "production" ||
    environment.ACADEMY_LOCAL_BOOTSTRAP_ENABLED !== "true"
  ) {
    return false;
  }

  return isLoopbackHostname(new URL(requestUrl).hostname);
}

export function resolveLocalBootstrapAcademyActor(
  request: Request,
  environment: NodeJS.ProcessEnv = process.env,
): AcademyActor {
  if (!canUseLocalAcademyBootstrap(request.url, environment)) {
    throw new AcademyAuthenticationError();
  }

  const userId = request.headers.get("x-academy-user-id")?.trim();
  const tenantId = request.headers.get("x-academy-tenant-id")?.trim();
  const roles = parseBootstrapRoles(request.headers.get("x-academy-roles"));

  if (!userId || !tenantId || roles.length === 0) {
    throw new AcademyAuthenticationError(
      "Local Academy bootstrap requires explicit user, tenant, and roles.",
    );
  }

  return { userId, tenantId, roles };
}

export interface ResolvedSessionAcademyActor {
  actor: AcademyActor;
  source: "supabase_session" | "local_bootstrap";
}

interface SessionUserReader {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
}

interface ResolveAcademyActorDependencies {
  sessionClient?: SessionUserReader;
  identityRepository?: AcademyIdentityRepository;
  now?: string;
  environment?: NodeJS.ProcessEnv;
}

export async function resolveAcademyActorFromSession(
  request: Request,
  dependencies: ResolveAcademyActorDependencies = {},
): Promise<ResolvedSessionAcademyActor> {
  try {
    const sessionClient = dependencies.sessionClient ?? (await createClient());
    const { data, error } = await sessionClient.auth.getUser();

    if (!error && data.user) {
      const actor = await resolveAcademyIdentity(
        dependencies.identityRepository ??
          new PostgresAcademyIdentityRepository(),
        data.user.id,
        dependencies.now,
      );
      return { actor, source: "supabase_session" };
    }
  } catch (error) {
    if (!canUseLocalAcademyBootstrap(request.url, dependencies.environment)) {
      if (error instanceof AcademyAuthenticationError) {
        throw error;
      }
      throw new AcademyAuthenticationError();
    }
  }

  if (canUseLocalAcademyBootstrap(request.url, dependencies.environment)) {
    return {
      actor: resolveLocalBootstrapAcademyActor(
        request,
        dependencies.environment,
      ),
      source: "local_bootstrap",
    };
  }

  throw new AcademyAuthenticationError();
}

export const resolveStudentAcademyActorFromSession =
  resolveAcademyActorFromSession;
