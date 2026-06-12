import { AcademyDataRepository } from "@/modules/academy-data/postgres-repository";
import { handleApi } from "@/app/api/academy/api-utils";
import { resolveBootstrapAcademyActor } from "@/modules/academy-auth/request-context";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const actor = resolveBootstrapAcademyActor(request.headers);
    const { id } = await context.params;
    const dataset = await new AcademyDataRepository().loadDataset(actor.tenantId);
    const student = dataset.students.find((item) => item.id === id);

    if (!student) {
      throw new Error(`Student ${id} was not found.`);
    }

    const program = dataset.programs.find((item) => item.id === student.programId);
    const advisor = dataset.administrators.find((item) => item.id === student.advisorUserId);

    return {
      student,
      program,
      advisor,
    };
  });
}

