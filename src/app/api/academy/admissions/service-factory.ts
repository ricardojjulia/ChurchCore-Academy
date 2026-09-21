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
import {
  EnrollmentConversionDatabase,
  PostgresEnrollmentConversionRepository,
} from "@/modules/enrollment-conversion/postgres-repository";
import { EnrollmentConversionService } from "@/modules/enrollment-conversion/service";
import {
  CourseRegistrationDatabase,
  PostgresCourseRegistrationRepository,
} from "@/modules/course-registration/postgres-repository";
import { CourseRegistrationService } from "@/modules/course-registration/service";

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

export function createEnrollmentConversionService(
  client: AcademyQueryClient,
) {
  return new EnrollmentConversionService(
    new PostgresEnrollmentConversionRepository(
      asAcademyDatabase<EnrollmentConversionDatabase>(client),
    ),
    new PostgresAcademyAuditRepository(
      asAcademyDatabase<AcademyAuditQuery>(client),
    ),
  );
}

export function createCourseRegistrationService(client: AcademyQueryClient) {
  return new CourseRegistrationService(
    new PostgresCourseRegistrationRepository(
      asAcademyDatabase<CourseRegistrationDatabase>(client),
    ),
  );
}
