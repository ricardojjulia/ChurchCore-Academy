import type { AcademyDatabase } from "@/lib/academy-database-context";
import type { Actor } from "@/lib/require-actor";
import { PostgresAcademicPeriodRepository } from "../academic-calendar/postgres-period-repository";

type CourseSectionRegistration = { id: string; courseSectionId: string };
type NewRegistrationData = { courseSectionId: string; studentId: string };

export class PostgresCourseSectionRegistrationRepository {
  constructor(private db: AcademyDatabase, private tenantId: string) {}

  async create(actor: Actor, data: NewRegistrationData): Promise<CourseSectionRegistration> {
    const sectionResult = await this.db.query(
      `SELECT academic_period_id FROM academy_course_sections WHERE id = $1 AND tenant_id = $2`,
      [data.courseSectionId, this.tenantId]
    );
    const periodId = sectionResult.rows[0]?.academic_period_id;

    if (!periodId) {
      throw new Error(`Course section '${data.courseSectionId}' not found.`);
    }

    const periodRepo = new PostgresAcademicPeriodRepository(this.db, this.tenantId);
    await periodRepo.assertPeriodIsNotCompleted(periodId);

    // ... existing logic to insert the registration record ...

    throw new Error("Create logic not fully implemented for this example.");
  }
}