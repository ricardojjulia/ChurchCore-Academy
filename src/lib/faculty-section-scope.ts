import type { AcademyActor } from "@/modules/academy-auth/policy";
import { hasAttendanceAdminAccess } from "@/modules/attendance/service";

interface InstructedSection {
  instructorFacultyId?: string;
  assistantInstructorIds?: readonly string[];
}

/**
 * The sections a faculty-portal user works with: every section for the oversight roles that can
 * record attendance anywhere, otherwise the sections they teach as primary or assistant
 * instructor. Mirrors the attendance service's own rule, so the portal never offers a section the
 * server would reject (the 2026-10-06 pilot dry run found the home page counting, and the
 * attendance picker listing, every section in the school for a faculty member with none).
 */
export function sectionsForActor<T extends InstructedSection>(sections: readonly T[], actor: AcademyActor): T[] {
  if (hasAttendanceAdminAccess(actor)) return [...sections];
  return sections.filter(
    (section) => section.instructorFacultyId === actor.userId || (section.assistantInstructorIds ?? []).includes(actor.userId),
  );
}
