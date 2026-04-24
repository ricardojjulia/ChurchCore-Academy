import { closeDatabasePool } from "@/lib/database";
import { AcademyDataRepository } from "@/modules/academy-data/postgres-repository";

async function main() {
  const repository = new AcademyDataRepository();
  await repository.seedFromMockData();
  console.log("Seeded local ChurchCore Academy source data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
