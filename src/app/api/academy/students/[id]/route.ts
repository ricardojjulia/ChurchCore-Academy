import { AcademyDataRepository } from "@/modules/academy-data/postgres-repository";
import { handleApi } from "@/app/api/academy/api-utils";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { id } = await context.params;
    const dataset = await new AcademyDataRepository().loadDataset();
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

