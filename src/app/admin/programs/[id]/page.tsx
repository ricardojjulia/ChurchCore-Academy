import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import {
  PostgresAcademicProgramRepository,
  type AcademicProgramDatabase,
} from "@/modules/academic-programs/postgres-repository";
import { ProgramDetailClient } from "./ProgramDetailClient";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireActor();

  const program = await withAcademyDatabaseContext(actor, async (client) => {
    const repo = new PostgresAcademicProgramRepository(asAcademyDatabase<AcademicProgramDatabase>(client));
    return repo.findById(actor.tenantId, id);
  });

  if (!program) notFound();

  return (
    <AdminShell
      activeSection="academics"
      eyebrow="Programs"
      title={program.title}
      subtitle={`${program.programCode} — program configuration, requirements, and lifecycle.`}
    >
      <ProgramDetailClient program={program} />
    </AdminShell>
  );
}
