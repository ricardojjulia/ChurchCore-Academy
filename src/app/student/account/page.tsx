import { StudentAccountView } from "@/components/student-account-view";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import {
  BillingDatabase,
  PostgresBillingRepository,
} from "@/modules/billing/postgres-repository";
import { BillingService } from "@/modules/billing/service";

export const dynamic = "force-dynamic";

export default async function StudentAccountPage() {
  const actor = await requireActor();
  const statement = await withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresBillingRepository(
      asAcademyDatabase<BillingDatabase>(client),
    );
    const service = new BillingService(repository);
    return service.readStudentStatement(actor, actor.userId);
  });

  return (
    <StudentPwaShell
      title="My Account"
      description="Your student account ledger, current balance, and payment actions."
    >
      <StudentAccountView statement={statement} />
    </StudentPwaShell>
  );
}
