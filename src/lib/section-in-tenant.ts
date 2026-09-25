import { notFound } from "next/navigation";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

/**
 * 404 unless the section exists in the actor's tenant. Section pages that only read
 * tenant-scoped data would otherwise render an empty shell for any id, including another
 * institution's section (found by the e2e sweep).
 */
export async function requireSectionInTenant(actor: AcademyActor, sectionId: string) {
  const exists = await withAcademyDatabaseContext(actor, async (client) => {
    const result = (await (client as { query(sql: string, values: unknown[]): Promise<{ rowCount: number | null }> }).query(
      "select 1 from academy_course_sections where tenant_id = $1 and id = $2",
      [actor.tenantId, sectionId],
    ));
    return Boolean(result.rowCount);
  });
  if (!exists) notFound();
}
