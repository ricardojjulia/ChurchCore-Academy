import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { timingSafeEqual } from "node:crypto";
import { getDatabasePool } from "@/lib/database";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { PostgresAcademyIdentityRepository } from "@/modules/academy-auth/postgres-identity-repository";
import { AcademyCourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";
import { AcademyPeopleRepository } from "@/modules/people/postgres-repository";
import { buildAcademyOneRosterExportPackage, buildOneRosterZipPackage, PostgresOneRosterRegistrationRepository } from "@/modules/oneroster-contract";
import { deliverOneRosterPackage, parseDeliveryConfiguration } from "@/modules/oneroster-contract/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const configuration = parseDeliveryConfiguration(process.env.ONEROSTER_DELIVERY_CONFIG, process.env.NODE_ENV !== "production");
    if (!configuration) return Response.json({ status: "disabled" });
    const pool = getDatabasePool();
    const tenant = await pool.query("select 1 from academy_tenant_registry where tenant_id = $1 and provisioning_status = 'ready' and lifecycle_status in ('development', 'trial', 'active')", [configuration.tenantId]);
    if (!tenant.rowCount) throw new Error();
    const identities = await new PostgresAcademyIdentityRepository(pool).findActiveIdentities(configuration.externalSubject, new Date().toISOString());
    const identity = identities.find(item => item.tenantId === configuration.tenantId);
    if (!identity) throw new Error();
    const actor = { tenantId: identity.tenantId, userId: identity.personId, roles: identity.roles };
    const result = await deliverOneRosterPackage({
      actor, configuration, privateKeyPem: process.env.ONEROSTER_SIGNING_PRIVATE_KEY ?? "",
      buildPackage: async () => {
        const csv = await withCapabilityContext(actor, async (client, capabilities) => {
          assertCapability(capabilities, "lmsRosterSync");
          return buildAcademyOneRosterExportPackage({
          actor, sectionId: configuration.sectionId,
          peopleRepository: new AcademyPeopleRepository(asAcademyDatabase<ConstructorParameters<typeof AcademyPeopleRepository>[0]>(client)),
          courseCatalogRepository: new AcademyCourseCatalogRepository(asAcademyDatabase<ConstructorParameters<typeof AcademyCourseCatalogRepository>[0]>(client)),
          registrationRepository: new PostgresOneRosterRegistrationRepository(asAcademyDatabase<ConstructorParameters<typeof PostgresOneRosterRegistrationRepository>[0]>(client)),
          });
        });
        return buildOneRosterZipPackage(csv);
      },
    });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "OneRoster delivery could not be confirmed. Check the connection and LMS history." }, { status: 503 });
  }
}
