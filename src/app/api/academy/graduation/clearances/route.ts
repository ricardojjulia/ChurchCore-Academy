import { NextResponse } from "next/server";
import { handleApi, requireStringField } from "@/app/api/academy/api-utils";
import {
  withAcademyDatabaseContext,
  asAcademyDatabase,
  AcademyQueryClient,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyActor } from "@/modules/academy-auth/policy";
import {
  PostgresGraduationClearanceRepository,
  GraduationDatabase,
} from "@/modules/graduation/postgres-repository";
import { GraduationClearanceService } from "@/modules/graduation/service";
import { GraduationClearance, InitiateClearanceInput } from "@/modules/graduation/types";

// ---------------------------------------------------------------------------
// Dependency interface — lets tests swap implementations without real DB
// ---------------------------------------------------------------------------

interface GraduationClearanceDependencies {
  resolveActor(request: Request): Promise<AcademyActor>;
  initiateClearance(
    actor: AcademyActor,
    input: InitiateClearanceInput,
  ): Promise<GraduationClearance>;
  getClearanceForStudent(
    actor: AcademyActor,
    studentProfileId: string,
  ): Promise<GraduationClearance | undefined>;
}

function buildService(client: AcademyQueryClient): GraduationClearanceService {
  const repo = new PostgresGraduationClearanceRepository(
    asAcademyDatabase<GraduationDatabase>(client),
  );
  return new GraduationClearanceService(repo);
}

const defaultDependencies: GraduationClearanceDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,

  initiateClearance: (actor, input) =>
    withAcademyDatabaseContext(actor, async (client) => {
      return buildService(client).initiate(actor, input);
    }),

  getClearanceForStudent: (actor, studentProfileId) =>
    withAcademyDatabaseContext(actor, async (client) => {
      return buildService(client).getForStudent(actor, studentProfileId);
    }),
};

// ---------------------------------------------------------------------------
// POST /api/academy/graduation/clearances
// Body: { studentProfileId, academicProgramId, academicYearId }
// Returns: GraduationClearance (201)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  return postClearanceRequest(request);
}

export async function postClearanceRequest(
  request: Request,
  dependencies: GraduationClearanceDependencies = defaultDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const body = (await request.json()) as Record<string, unknown>;

    const input: InitiateClearanceInput = {
      studentProfileId: requireStringField(body.studentProfileId, "studentProfileId"),
      academicProgramId: requireStringField(body.academicProgramId, "academicProgramId"),
      academicYearId: requireStringField(body.academicYearId, "academicYearId"),
    };

    const clearance = await dependencies.initiateClearance(actor, input);

    return NextResponse.json(clearance, { status: 201 });
  });
}

// ---------------------------------------------------------------------------
// GET /api/academy/graduation/clearances?studentId=<uuid>
// Returns: { clearance: GraduationClearance | null } (200)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  return getClearanceRequest(request);
}

export async function getClearanceRequest(
  request: Request,
  dependencies: GraduationClearanceDependencies = defaultDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      throw new Error("studentId query parameter is required.");
    }

    const clearance = await dependencies.getClearanceForStudent(actor, studentId);

    return { clearance: clearance ?? null };
  });
}
