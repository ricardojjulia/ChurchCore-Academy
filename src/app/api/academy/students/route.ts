import { AcademyDataRepository } from "@/modules/academy-data/postgres-repository";
import { handleApi } from "@/app/api/academy/api-utils";

export async function GET() {
  return handleApi(async () => {
    const dataset = await new AcademyDataRepository().loadDataset();
    return {
      students: dataset.students,
      count: dataset.students.length,
    };
  });
}

