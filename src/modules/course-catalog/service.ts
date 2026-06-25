import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type {
  Course,
  CourseSection,
  CoursePrerequisite,
  CourseStatus,
  CourseSectionStatus,
} from "@/modules/course-catalog/types";
import type { CourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";

const catalogAdminRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
  "academic_admin",
  "dean",
]);

export function hasCatalogAdminAccess(actor: AcademyActor) {
  return actor.roles.some((role) => catalogAdminRoles.has(role));
}

function assertCatalogAdmin(actor: AcademyActor) {
  if (!hasCatalogAdminAccess(actor)) {
    throw new AcademyAuthorizationError(
      "Forbidden course catalog administration access.",
    );
  }
}

function assertTenantMatch(actor: AcademyActor, tenantId: string) {
  if (actor.tenantId !== tenantId) {
    throw new AcademyAuthorizationError("Cross-tenant access denied.");
  }
}

function requireText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
}

function requirePositiveNumber(value: number | undefined, field: string) {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new Error(`${field} must be a positive number.`);
  }
  return value;
}

/**
 * Validate prerequisites for circular dependency.
 * Uses DFS to detect cycles in the prerequisite graph.
 */
export function validatePrerequisites(
  courseId: string,
  prerequisiteIds: string[],
  allPrerequisites: CoursePrerequisite[],
): void {
  // Check for self-reference
  if (prerequisiteIds.includes(courseId)) {
    throw new Error("A course cannot be a prerequisite of itself.");
  }

  // Build adjacency map for DFS
  const adjacency = new Map<string, string[]>();
  for (const prereq of allPrerequisites) {
    if (!adjacency.has(prereq.courseId)) {
      adjacency.set(prereq.courseId, []);
    }
    adjacency.get(prereq.courseId)!.push(prereq.requiredCourseId);
  }

  // Add new prerequisites to the graph temporarily
  adjacency.set(courseId, prerequisiteIds);

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      return true; // Cycle detected
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  if (hasCycle(courseId)) {
    throw new Error("Circular prerequisite dependency detected.");
  }
}

export class CourseCatalogService {
  constructor(private readonly repository: CourseCatalogRepository) {}

  async createCourse(
    actor: AcademyActor,
    input: {
      code: string;
      title: string;
      description: string;
      courseType: Course["courseType"];
      courseLevel: Course["courseLevel"];
      recordType: Course["recordType"];
      defaultCredits?: number;
      defaultClockHours?: number;
      owningSubdivisionId?: string;
      prerequisiteIds?: string[];
    },
  ): Promise<Course> {
    assertCatalogAdmin(actor);

    const code = requireText(input.code, "code");
    const title = requireText(input.title, "title");
    const description = requireText(input.description, "description");

    requirePositiveNumber(input.defaultCredits, "defaultCredits");
    requirePositiveNumber(input.defaultClockHours, "defaultClockHours");

    // Validate prerequisites for cycles
    if (input.prerequisiteIds && input.prerequisiteIds.length > 0) {
      const allPrerequisites = await this.repository.fetchPrerequisites(actor.tenantId);
      validatePrerequisites("temp-new-course", input.prerequisiteIds, allPrerequisites);
    }

    // Check for duplicate code
    const existingCourse = await this.repository.findCourseByCode(actor.tenantId, code);
    if (existingCourse) {
      throw new Error("Course code already exists in your catalog.");
    }

    return this.repository.createCourse({
      tenantId: actor.tenantId,
      code,
      title,
      description,
      courseType: input.courseType,
      courseLevel: input.courseLevel,
      recordType: input.recordType,
      defaultCredits: input.defaultCredits,
      defaultClockHours: input.defaultClockHours,
      owningSubdivisionId: input.owningSubdivisionId,
      prerequisiteIds: input.prerequisiteIds ?? [],
      status: "draft",
    });
  }

  async updateCourse(
    actor: AcademyActor,
    courseId: string,
    input: {
      title?: string;
      description?: string;
      defaultCredits?: number;
      defaultClockHours?: number;
      owningSubdivisionId?: string;
      prerequisiteIds?: string[];
      status?: CourseStatus;
    },
  ): Promise<Course> {
    assertCatalogAdmin(actor);

    const course = await this.repository.findCourseById(courseId);
    if (!course) {
      throw new Error("Course not found.");
    }
    assertTenantMatch(actor, course.tenantId);

    // Validate prerequisites for cycles if being updated
    if (input.prerequisiteIds && input.prerequisiteIds.length > 0) {
      const allPrerequisites = await this.repository.fetchPrerequisites(actor.tenantId);
      validatePrerequisites(courseId, input.prerequisiteIds, allPrerequisites);
    }

    requirePositiveNumber(input.defaultCredits, "defaultCredits");
    requirePositiveNumber(input.defaultClockHours, "defaultClockHours");

    return this.repository.updateCourse(courseId, {
      title: input.title ? requireText(input.title, "title") : undefined,
      description: input.description ? requireText(input.description, "description") : undefined,
      defaultCredits: input.defaultCredits,
      defaultClockHours: input.defaultClockHours,
      owningSubdivisionId: input.owningSubdivisionId,
      prerequisiteIds: input.prerequisiteIds,
      status: input.status,
    });
  }

  async archiveCourse(
    actor: AcademyActor,
    courseId: string,
  ): Promise<Course> {
    assertCatalogAdmin(actor);

    const course = await this.repository.findCourseById(courseId);
    if (!course) {
      throw new Error("Course not found.");
    }
    assertTenantMatch(actor, course.tenantId);

    // Check for active sections
    const activeSections = await this.repository.findActiveSectionsByCourseId(courseId);
    if (activeSections.length > 0) {
      throw new Error(
        "Cannot archive course with active sections. Remove or complete sections first.",
      );
    }

    return this.repository.updateCourse(courseId, { status: "archived" });
  }

  async createSection(
    actor: AcademyActor,
    input: {
      courseId: string;
      academicYearId: string;
      academicPeriodId: string;
      sectionCode: string;
      deliveryMode: CourseSection["deliveryMode"];
      capacity?: number;
      primaryInstructorId?: string;
      schedulePattern?: string;
      subdivisionId?: string;
    },
  ): Promise<CourseSection> {
    assertCatalogAdmin(actor);

    const course = await this.repository.findCourseById(input.courseId);
    if (!course) {
      throw new Error("Course not found.");
    }
    assertTenantMatch(actor, course.tenantId);

    if (course.status === "archived") {
      throw new Error("Cannot create sections for archived courses.");
    }

    const sectionCode = requireText(input.sectionCode, "sectionCode");
    requirePositiveNumber(input.capacity, "capacity");

    // Check for duplicate section code within course-period
    const existingSection = await this.repository.findSectionByCodeAndPeriod(
      input.courseId,
      input.academicPeriodId,
      sectionCode,
    );
    if (existingSection) {
      throw new Error("Section code must be unique within a course-period combination.");
    }

    return this.repository.createSection({
      tenantId: actor.tenantId,
      courseId: input.courseId,
      academicYearId: input.academicYearId,
      academicPeriodId: input.academicPeriodId,
      sectionCode,
      deliveryMode: input.deliveryMode,
      capacity: input.capacity,
      primaryInstructorId: input.primaryInstructorId,
      schedulePattern: input.schedulePattern,
      subdivisionId: input.subdivisionId,
      status: "draft",
    });
  }

  async updateSection(
    actor: AcademyActor,
    sectionId: string,
    input: {
      capacity?: number;
      primaryInstructorId?: string;
      schedulePattern?: string;
      status?: CourseSectionStatus;
    },
  ): Promise<CourseSection> {
    assertCatalogAdmin(actor);

    const section = await this.repository.findSectionById(sectionId);
    if (!section) {
      throw new Error("Section not found.");
    }
    assertTenantMatch(actor, section.tenantId);

    // Check enrollment count if reducing capacity
    if (input.capacity !== undefined) {
      const enrollmentCount = await this.repository.getEnrollmentCount(sectionId);
      if (input.capacity < enrollmentCount) {
        throw new Error(
          `Cannot reduce capacity below current enrollment of ${enrollmentCount} students.`,
        );
      }
    }

    // Lock instructor reassignment once enrollment_open
    if (
      input.primaryInstructorId !== undefined &&
      (section.status === "open" || section.status === "in_progress" || section.status === "completed")
    ) {
      throw new Error("Cannot reassign instructor after enrollment has opened.");
    }

    requirePositiveNumber(input.capacity, "capacity");

    return this.repository.updateSection(sectionId, {
      capacity: input.capacity,
      primaryInstructorId: input.primaryInstructorId,
      schedulePattern: input.schedulePattern,
      status: input.status,
    });
  }

  async transitionSectionStatus(
    actor: AcademyActor,
    sectionId: string,
    newStatus: CourseSectionStatus,
  ): Promise<CourseSection> {
    return this.updateSection(actor, sectionId, { status: newStatus });
  }

  /**
   * Check if a student has completed all prerequisites for a course.
   * Returns true if all prerequisites are satisfied.
   */
  async checkPrerequisites(
    studentPersonId: string,
    courseId: string,
  ): Promise<{ satisfied: boolean; missingCourses: string[] }> {
    const prerequisites = await this.repository.fetchPrerequisitesByCourseId(courseId);
    if (prerequisites.length === 0) {
      return { satisfied: true, missingCourses: [] };
    }

    const completedCourseIds = await this.repository.fetchCompletedCourseIds(studentPersonId);
    const completedSet = new Set(completedCourseIds);

    const missingCourses: string[] = [];
    for (const prereq of prerequisites) {
      if (prereq.requirementType === "required_before_registration") {
        if (!completedSet.has(prereq.requiredCourseId)) {
          missingCourses.push(prereq.requiredCourseId);
        }
      }
    }

    return {
      satisfied: missingCourses.length === 0,
      missingCourses,
    };
  }

  async listCourses(
    actor: AcademyActor,
    filters?: {
      subdivisionId?: string;
      includeArchived?: boolean;
    },
  ): Promise<Course[]> {
    assertTenantMatch(actor, actor.tenantId);
    return this.repository.listCourses(actor.tenantId, filters);
  }

  async getCourse(
    actor: AcademyActor,
    courseId: string,
  ): Promise<Course | null> {
    const course = await this.repository.findCourseById(courseId);
    if (course) {
      assertTenantMatch(actor, course.tenantId);
    }
    return course;
  }

  async listSectionsByCourse(
    actor: AcademyActor,
    courseId: string,
  ): Promise<CourseSection[]> {
    const course = await this.repository.findCourseById(courseId);
    if (!course) {
      throw new Error("Course not found.");
    }
    assertTenantMatch(actor, course.tenantId);
    return this.repository.listSectionsByCourseId(courseId);
  }
}
