import {
  AcademyQueryClient,
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import {
  LearnerIntelligenceDatabase,
  LearnerIntelligencePostgresRepository,
} from "@/modules/learner-intelligence/postgres-repository";
import { LearnerIntelligenceService } from "@/modules/learner-intelligence/service";

export function createLearnerIntelligenceService(client: AcademyQueryClient) {
  return new LearnerIntelligenceService(
    new LearnerIntelligencePostgresRepository(
      asAcademyDatabase<LearnerIntelligenceDatabase>(client),
    ),
  );
}
