import { AcademyActor } from "@/modules/academy-auth/policy";
import { canAccessPeopleDomain } from "@/modules/people/access-policy";
import { GuardianAccessCategory } from "@/modules/people/validation";
import { PeopleConfiguration, StudentProfile } from "@/modules/people/types";

export type StudentPwaAccessMode = "student_self" | "guardian_relationship";

export interface StudentPwaAccess {
  accessMode: StudentPwaAccessMode;
  studentProfile: StudentProfile;
  allowedCategories: ReadonlySet<GuardianAccessCategory>;
}

const studentCategories: GuardianAccessCategory[] = ["directory", "schedule", "documents", "progress", "grades"];

function hasActiveActorRole(config: PeopleConfiguration, actor: AcademyActor, role: "student" | "guardian") {
  return config.roleAssignments.some(
    (assignment) =>
      assignment.tenantId === actor.tenantId &&
      assignment.personId === actor.userId &&
      assignment.role === role &&
      assignment.status === "active" &&
      actor.roles.includes(role),
  );
}

export function resolveStudentPwaAccess(
  actor: AcademyActor,
  config: PeopleConfiguration,
  targetStudentPersonId: string,
  asOf?: string,
): StudentPwaAccess {
  if (actor.tenantId !== config.institutionProfile.tenantId) {
    throw new Error("Forbidden student PWA access.");
  }

  const studentProfile = config.studentProfiles.find(
    (profile) => profile.tenantId === actor.tenantId && profile.personId === targetStudentPersonId,
  );
  const studentPerson = config.people.find(
    (person) => person.tenantId === actor.tenantId && person.id === targetStudentPersonId && person.personStatus === "active",
  );

  if (!studentProfile || !studentPerson) {
    throw new Error("Forbidden student PWA access.");
  }

  if (hasActiveActorRole(config, actor, "student") && actor.userId === targetStudentPersonId) {
    return {
      accessMode: "student_self",
      studentProfile,
      allowedCategories: new Set(studentCategories),
    };
  }

  if (hasActiveActorRole(config, actor, "guardian")) {
    const allowedCategories = new Set(
      studentCategories.filter((category) =>
        canAccessPeopleDomain(actor, config, {
          action: "read_student",
          tenantId: actor.tenantId,
          targetPersonId: targetStudentPersonId,
          guardianCategory: category,
          asOf,
        }),
      ),
    );

    if (allowedCategories.has("directory")) {
      return {
        accessMode: "guardian_relationship",
        studentProfile,
        allowedCategories,
      };
    }
  }

  throw new Error("Forbidden student PWA access.");
}
