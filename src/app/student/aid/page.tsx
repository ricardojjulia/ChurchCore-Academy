import { StudentAidView } from "@/components/student-aid-view";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import {
  FinancialAidDatabase,
  PostgresFinancialAidRepository,
} from "@/modules/financial-aid/postgres-repository";
import { FinancialAidService } from "@/modules/financial-aid/service";

export const dynamic = "force-dynamic";

export default async function StudentAidPage() {
  const actor = await requireActor();
  const summary = await withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresFinancialAidRepository(
      asAcademyDatabase<FinancialAidDatabase>(client),
    );
    const service = new FinancialAidService(repository);
    return service.readStudentAid(actor, actor.userId);
  });

  return (
    <StudentPwaShell
      title="My Aid"
      description="Your released institutional aid awards, disbursements, and requirements."
    >
      <StudentAidView summary={summary} />
    </StudentPwaShell>
  );
}
