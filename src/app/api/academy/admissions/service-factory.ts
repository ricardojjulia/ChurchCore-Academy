import {
  AcademyQueryClient,
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import {
  AdmissionsDatabase,
  PostgresAdmissionsRepository,
} from "@/modules/admissions/postgres-repository";
import { AdmissionsService } from "@/modules/admissions/service";
import {
  AcademyAuditQuery,
  PostgresAcademyAuditRepository,
} from "@/modules/audit/postgres-repository";

export function createAdmissionsService(client: AcademyQueryClient) {
  return new AdmissionsService(
    new PostgresAdmissionsRepository(
      asAcademyDatabase<AdmissionsDatabase>(client),
    ),
    new PostgresAcademyAuditRepository(
      asAcademyDatabase<AcademyAuditQuery>(client),
    ),
  );
}
