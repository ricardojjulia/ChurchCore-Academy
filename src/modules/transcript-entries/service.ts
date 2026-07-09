import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type {
  TranscriptEntry,
  TranscriptEntryCandidate,
  TranscriptEntryRepository,
} from "./types";

const transcriptEntryRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
]);

function assertAccess(actor: AcademyActor) {
  if (!actor.roles.some((role) => transcriptEntryRoles.has(role))) {
    throw new AcademyAuthorizationError("Forbidden transcript entry access.");
  }
}

function requireText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  return trimmed;
}

export class TranscriptEntryService {
  constructor(private readonly repository: TranscriptEntryRepository) {}

  async listByStudent(actor: AcademyActor, studentProfileId: string): Promise<TranscriptEntry[]> {
    assertAccess(actor);
    return this.repository.listByStudent(actor.tenantId, requireText(studentProfileId, "studentProfileId"));
  }

  async listCandidates(actor: AcademyActor, studentProfileId: string): Promise<TranscriptEntryCandidate[]> {
    assertAccess(actor);
    return this.repository.listCandidates(actor.tenantId, requireText(studentProfileId, "studentProfileId"));
  }

  async createFromRegistration(
    actor: AcademyActor,
    studentProfileId: string,
    registrationId: string,
  ): Promise<TranscriptEntry> {
    assertAccess(actor);
    return this.repository.createFromRegistration(
      actor.tenantId,
      requireText(studentProfileId, "studentProfileId"),
      requireText(registrationId, "registrationId"),
      actor.userId,
    );
  }
}
