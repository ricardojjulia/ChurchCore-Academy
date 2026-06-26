import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { CourseCatalogService, validatePrerequisites } from "@/modules/course-catalog/service";
import type {
  Course,
  CourseSection,
  CoursePrerequisite,
} from "@/modules/course-catalog/types";
import type { CourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";

const admin: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const student: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const crossTenantAdmin: AcademyActor = {
  userId: "person-admin-2",
  tenantId: "tenant-2",
  roles: ["institution_admin"],
};

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: "course-1",
    tenantId: "tenant-1",
    code: "BIB101",
    title: "Introduction to Biblical Studies",
    description: "A foundational course in biblical interpretation.",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
    defaultDuration: {
      durationUnit: "credit_hour",
      durationValue: 3,
      creditHours: 3,
    },
    defaultCredits: 3,
    status: "active",
    createdAt: "2026-06-21T05:00:00.000Z",
    updatedAt: "2026-06-21T05:00:00.000Z",
    ...overrides,
  };
}

function section(overrides: Partial<CourseSection> = {}): CourseSection {
  return {
    id: "section-1",
    tenantId: "tenant-1",
    courseId: "course-1",
    academicYearId: "year-1",
    academicPeriodId: "period-1",
    sectionCode: "A",
    deliveryMode: "in_person",
    status: "draft",
    primaryInstructorRole: "instructor",
    assistantInstructorIds: [],
    createdAt: "2026-06-21T05:00:00.000Z",
    updatedAt: "2026-06-21T05:00:00.000Z",
    ...overrides,
  };
}

function prerequisite(overrides: Partial<CoursePrerequisite> = {}): CoursePrerequisite {
  return {
    id: "prereq-1",
    tenantId: "tenant-1",
    courseId: "course-2",
    requiredCourseId: "course-1",
    requirementType: "required_before_registration",
    createdAt: "2026-06-21T05:00:00.000Z",
    updatedAt: "2026-06-21T05:00:00.000Z",
    ...overrides,
  };
}

function mockRepository(): CourseCatalogRepository & { calls: string[] } {
  const calls: string[] = [];
  const courses: Course[] = [];
  const sections: CourseSection[] = [];
  const prerequisites: CoursePrerequisite[] = [];

  return {
    calls,
    async fetchCourseCatalogConfiguration() {
      calls.push("fetchCourseCatalogConfiguration");
      throw new Error("Not implemented in mock");
    },
    async findCourseById(courseId: string) {
      calls.push(`findCourseById:${courseId}`);
      return courses.find((c) => c.id === courseId) ?? null;
    },
    async findCourseByCode(tenantId: string, code: string) {
      calls.push(`findCourseByCode:${tenantId}:${code}`);
      return courses.find((c) => c.tenantId === tenantId && c.code === code) ?? null;
    },
    async createCourse(input) {
      calls.push(`createCourse:${input.code}`);
      const newCourse = course({
        id: `course-${courses.length + 1}`,
        ...input,
      });
      courses.push(newCourse);
      if (input.prerequisiteIds) {
        for (const requiredCourseId of input.prerequisiteIds) {
          prerequisites.push(prerequisite({
            id: `prereq-${prerequisites.length + 1}`,
            tenantId: input.tenantId ?? "tenant-1",
            courseId: newCourse.id,
            requiredCourseId,
          }));
        }
      }
      return newCourse;
    },
    async updateCourse(courseId, updates) {
      calls.push(`updateCourse:${courseId}`);
      const idx = courses.findIndex((c) => c.id === courseId);
      if (idx === -1) throw new Error("Course not found.");
      courses[idx] = { ...courses[idx], ...updates };
      return courses[idx];
    },
    async findActiveSectionsByCourseId(courseId: string) {
      calls.push(`findActiveSectionsByCourseId:${courseId}`);
      return sections.filter(
        (s) =>
          s.courseId === courseId &&
          (s.status === "scheduled" || s.status === "open" || s.status === "in_progress"),
      );
    },
    async createSection(input) {
      calls.push(`createSection:${input.sectionCode}`);
      const newSection = section({
        id: `section-${sections.length + 1}`,
        ...input,
      });
      sections.push(newSection);
      return newSection;
    },
    async findSectionById(sectionId: string) {
      calls.push(`findSectionById:${sectionId}`);
      return sections.find((s) => s.id === sectionId) ?? null;
    },
    async findSectionByCodeAndPeriod(courseId, periodId, sectionCode) {
      calls.push(`findSectionByCodeAndPeriod:${courseId}:${periodId}:${sectionCode}`);
      return (
        sections.find(
          (s) =>
            s.courseId === courseId &&
            s.academicPeriodId === periodId &&
            s.sectionCode === sectionCode,
        ) ?? null
      );
    },
    async updateSection(sectionId, updates) {
      calls.push(`updateSection:${sectionId}`);
      const idx = sections.findIndex((s) => s.id === sectionId);
      if (idx === -1) throw new Error("Section not found.");
      sections[idx] = { ...sections[idx], ...updates };
      return sections[idx];
    },
    async getEnrollmentCount(sectionId: string) {
      calls.push(`getEnrollmentCount:${sectionId}`);
      return 0;
    },
    async fetchPrerequisites(tenantId: string) {
      calls.push(`fetchPrerequisites:${tenantId}`);
      return prerequisites.filter((p) => p.tenantId === tenantId);
    },
    async fetchPrerequisitesByCourseId(courseId: string) {
      calls.push(`fetchPrerequisitesByCourseId:${courseId}`);
      return prerequisites.filter((p) => p.courseId === courseId);
    },
    async fetchCompletedCourseIds(studentPersonId: string) {
      calls.push(`fetchCompletedCourseIds:${studentPersonId}`);
      return [];
    },
    async listCourses(tenantId: string, filters) {
      calls.push(`listCourses:${tenantId}`);
      let filtered = courses.filter((c) => c.tenantId === tenantId);
      if (filters?.subdivisionId) {
        filtered = filtered.filter((c) => c.owningSubdivisionId === filters.subdivisionId);
      }
      if (!filters?.includeArchived) {
        filtered = filtered.filter((c) => c.status !== "archived");
      }
      return filtered;
    },
    async listSectionsByCourseId(courseId: string) {
      calls.push(`listSectionsByCourseId:${courseId}`);
      return sections.filter((s) => s.courseId === courseId);
    },
  };
}

test("validatePrerequisites: rejects self-reference", () => {
  assert.throws(
    () => validatePrerequisites("course-1", ["course-1"], []),
    /cannot be a prerequisite of itself/,
  );
});

test("validatePrerequisites: rejects circular dependency", () => {
  const prereqs = [
    prerequisite({ courseId: "course-2", requiredCourseId: "course-1" }),
    prerequisite({ courseId: "course-3", requiredCourseId: "course-2" }),
  ];

  assert.throws(
    () => validatePrerequisites("course-1", ["course-3"], prereqs),
    /Circular prerequisite dependency/,
  );
});

test("validatePrerequisites: allows valid prerequisites", () => {
  const prereqs = [prerequisite({ courseId: "course-2", requiredCourseId: "course-1" })];
  assert.doesNotThrow(() => validatePrerequisites("course-3", ["course-2"], prereqs));
});

test("createCourse: success", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const result = await service.createCourse(admin, {
    code: "BIB101",
    title: "Introduction to Biblical Studies",
    description: "A foundational course",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
    defaultCredits: 3,
  });

  assert.strictEqual(result.code, "BIB101");
  assert.strictEqual(result.status, "draft");
  assert(repo.calls.includes("findCourseByCode:tenant-1:BIB101"));
  assert(repo.calls.includes("createCourse:BIB101"));
});

test("createCourse: duplicate code rejection", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  await service.createCourse(admin, {
    code: "BIB101",
    title: "Course 1",
    description: "Description",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  await assert.rejects(
    service.createCourse(admin, {
      code: "BIB101",
      title: "Course 2",
      description: "Description",
      courseType: "bible_course",
      courseLevel: "undergraduate",
      recordType: "credit_course",
    }),
    /Course code already exists/,
  );
});

test("updateCourse: cross-tenant rejection", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const created = await service.createCourse(admin, {
    code: "BIB101",
    title: "Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  // Admin from tenant-2 cannot update a tenant-1 course
  await assert.rejects(
    service.updateCourse(crossTenantAdmin, created.id, {
      title: "Hacked Title",
    }),
    (err: Error) => err.message.includes("Cross-tenant"),
  );
});

test("createCourse: student rejection", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  await assert.rejects(
    service.createCourse(student, {
      code: "BIB101",
      title: "Course",
      description: "Desc",
      courseType: "bible_course",
      courseLevel: "undergraduate",
      recordType: "credit_course",
    }),
    /Forbidden course catalog/,
  );
});

test("updateCourse: success", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const created = await service.createCourse(admin, {
    code: "BIB101",
    title: "Original Title",
    description: "Original description",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
    defaultCredits: 3,
  });

  const updated = await service.updateCourse(admin, created.id, {
    title: "Updated Title",
    defaultCredits: 4,
  });

  assert.strictEqual(updated.title, "Updated Title");
  assert.strictEqual(updated.defaultCredits, 4);
});

test("archiveCourse: success when no active sections", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const created = await service.createCourse(admin, {
    code: "BIB101",
    title: "Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  const archived = await service.archiveCourse(admin, created.id);
  assert.strictEqual(archived.status, "archived");
});

test("archiveCourse: rejection when active sections exist", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const created = await service.createCourse(admin, {
    code: "BIB101",
    title: "Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  await repo.createSection({
    tenantId: "tenant-1",
    courseId: created.id,
    academicYearId: "year-1",
    academicPeriodId: "period-1",
    sectionCode: "A",
    deliveryMode: "in_person",
    status: "open",
  });

  await assert.rejects(
    service.archiveCourse(admin, created.id),
    /Cannot archive course with active sections/,
  );
});

test("createSection: success", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const created = await service.createCourse(admin, {
    code: "BIB101",
    title: "Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  // Activate course
  await service.updateCourse(admin, created.id, { status: "active" });

  const createdSection = await service.createSection(admin, {
    courseId: created.id,
    academicYearId: "year-1",
    academicPeriodId: "period-1",
    sectionCode: "A",
    deliveryMode: "in_person",
    capacity: 30,
    primaryInstructorId: "person-faculty",
  });

  assert.strictEqual(createdSection.sectionCode, "A");
  assert.strictEqual(createdSection.status, "draft");
  assert.strictEqual(createdSection.primaryInstructorId, "person-faculty");
});

test("createSection: duplicate section code rejection", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const created = await service.createCourse(admin, {
    code: "BIB101",
    title: "Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  await service.updateCourse(admin, created.id, { status: "active" });

  await service.createSection(admin, {
    courseId: created.id,
    academicYearId: "year-1",
    academicPeriodId: "period-1",
    sectionCode: "A",
    deliveryMode: "in_person",
  });

  await assert.rejects(
    service.createSection(admin, {
      courseId: created.id,
      academicYearId: "year-1",
      academicPeriodId: "period-1",
      sectionCode: "A",
      deliveryMode: "in_person",
    }),
    /Section code must be unique/,
  );
});

test("updateSection: capacity reduction below enrollment blocked", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const created = await service.createCourse(admin, {
    code: "BIB101",
    title: "Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  await service.updateCourse(admin, created.id, { status: "active" });

  const createdSection = await service.createSection(admin, {
    courseId: created.id,
    academicYearId: "year-1",
    academicPeriodId: "period-1",
    sectionCode: "A",
    deliveryMode: "in_person",
    capacity: 30,
  });

  // Mock enrollment count to return 10
  repo.getEnrollmentCount = async () => 10;

  await assert.rejects(
    service.updateSection(admin, createdSection.id, { capacity: 5 }),
    /Cannot reduce capacity below current enrollment/,
  );
});

test("updateSection: instructor reassignment locked after enrollment_open", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const created = await service.createCourse(admin, {
    code: "BIB101",
    title: "Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  await service.updateCourse(admin, created.id, { status: "active" });

  const createdSection = await service.createSection(admin, {
    courseId: created.id,
    academicYearId: "year-1",
    academicPeriodId: "period-1",
    sectionCode: "A",
    deliveryMode: "in_person",
    primaryInstructorId: "person-faculty-1",
  });

  // Transition to open
  await service.updateSection(admin, createdSection.id, { status: "open" });

  // Try to reassign instructor
  await assert.rejects(
    service.updateSection(admin, createdSection.id, { primaryInstructorId: "person-faculty-2" }),
    /Cannot reassign instructor after enrollment has opened/,
  );
});

test("checkPrerequisites: returns true when student has completed all prerequisites", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const course1 = await service.createCourse(admin, {
    code: "BIB101",
    title: "Course 1",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  const course2 = await service.createCourse(admin, {
    code: "BIB201",
    title: "Course 2",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
    prerequisiteIds: [course1.id],
  });

  // Mock completed courses
  repo.fetchCompletedCourseIds = async () => [course1.id];

  const result = await service.checkPrerequisites("person-student", course2.id);
  assert.strictEqual(result.satisfied, true);
  assert.strictEqual(result.missingCourses.length, 0);
});

test("checkPrerequisites: returns false when student missing prerequisites", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  const course1 = await service.createCourse(admin, {
    code: "BIB101",
    title: "Course 1",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  const course2 = await service.createCourse(admin, {
    code: "BIB201",
    title: "Course 2",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
    prerequisiteIds: [course1.id],
  });

  // Mock no completed courses
  repo.fetchCompletedCourseIds = async () => [];

  const result = await service.checkPrerequisites("person-student", course2.id);
  assert.strictEqual(result.satisfied, false);
  assert.strictEqual(result.missingCourses.length, 1);
  assert.strictEqual(result.missingCourses[0], course1.id);
});

test("listCourses: excludes archived by default", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  await service.createCourse(admin, {
    code: "BIB101",
    title: "Active Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  const archived = await service.createCourse(admin, {
    code: "BIB102",
    title: "Archived Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  await service.archiveCourse(admin, archived.id);

  const courses = await service.listCourses(admin);
  assert.strictEqual(courses.length, 1);
  assert.strictEqual(courses[0].code, "BIB101");
});

test("listCourses: includes archived when requested", async () => {
  const repo = mockRepository();
  const service = new CourseCatalogService(repo);

  await service.createCourse(admin, {
    code: "BIB101",
    title: "Active Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  const archived = await service.createCourse(admin, {
    code: "BIB102",
    title: "Archived Course",
    description: "Desc",
    courseType: "bible_course",
    courseLevel: "undergraduate",
    recordType: "credit_course",
  });

  await service.archiveCourse(admin, archived.id);

  const courses = await service.listCourses(admin, { includeArchived: true });
  assert.strictEqual(courses.length, 2);
});
