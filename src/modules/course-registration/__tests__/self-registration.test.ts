import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  registerStudentForSection,
  dropStudentFromSection,
} from "@/modules/course-registration/self-registration";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  readonly queries: string[] = [];

  private registrations: Record<string, unknown>[] = [];
  private sections: Record<string, unknown>[] = [];
  private enrollmentWindows: Record<string, unknown>[] = [];
  private prerequisites: Record<string, unknown>[] = [];
  private studentProfiles: Record<string, unknown>[] = [];
  private periodRegistrations: Record<string, unknown>[] = [];
  private auditEvents: Record<string, unknown>[] = [];

  constructor() {
    // Setup default section
    this.sections.push({
      id: "section-123",
      tenant_id: "tenant-a",
      academic_period_id: "period-1",
      course_id: "course-1",
      capacity: 20,
      status: "open",
    });

    // Setup enrollment window
    this.enrollmentWindows.push({
      id: "window-1",
      tenant_id: "tenant-a",
      academic_period_id: "period-1",
      window_type: "add_drop",
      opens_at: new Date("2026-01-01"),
      closes_at: new Date("2026-12-31"),
    });

    // Setup student profile
    this.studentProfiles.push({
      id: "profile-123",
      tenant_id: "tenant-a",
      person_id: "student-123",
    });

    // Setup period registration
    this.periodRegistrations.push({
      id: "period-reg-123",
      tenant_id: "tenant-a",
      student_profile_id: "profile-123",
      program_enrollment_id: "program-enroll-123",
      academic_period_id: "period-1",
    });
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    this.queries.push(sql);
    const normalized = sql.toLowerCase().trim();

    if (["begin", "commit", "rollback"].includes(normalized)) {
      return { rowCount: null, rows: [] };
    }

    if (normalized.includes("insert into academy_audit_events")) {
      const [tenantId, actorPersonId, action, entityType, entityId, , redactedMetadata] = params;
      const auditEvent = {
        id: `audit-${this.auditEvents.length + 1}`,
        tenant_id: tenantId,
        actor_person_id: actorPersonId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        redacted_metadata: typeof redactedMetadata === "string"
          ? JSON.parse(redactedMetadata) as Record<string, unknown>
          : redactedMetadata,
      };
      this.auditEvents.push(auditEvent);
      return { rowCount: 1, rows: [auditEvent] };
    }

    // Get section with enrollment window — check BEFORE the registration check because
    // the section query contains a subquery against academy_course_section_registrations
    // that would otherwise match the registration condition first.
    if (
      normalized.includes("select s.id") &&
      normalized.includes("academy_course_sections s") &&
      normalized.includes("academy_enrollment_windows ew")
    ) {
      const [tenantId, sectionId] = params;
      const section = this.sections.find((s) => s.tenant_id === tenantId && s.id === sectionId);
      if (!section) {
        return { rowCount: 0, rows: [] };
      }

      const window = this.enrollmentWindows.find(
        (w) => w.tenant_id === tenantId && w.academic_period_id === section.academic_period_id,
      );

      const currentEnrollment = this.registrations.filter(
        (r) =>
          r.tenant_id === tenantId &&
          r.course_section_id === sectionId &&
          ["pending_confirmation", "registered"].includes(String(r.status)),
      ).length;

      return {
        rowCount: 1,
        rows: [
          {
            ...section,
            current_enrollment: currentEnrollment,
            enrollment_window_id: window?.id ?? null,
            opens_at: window?.opens_at ?? null,
            closes_at: window?.closes_at ?? null,
          },
        ],
      };
    }

    // Check for existing registration (after section+window check to avoid subquery collision)
    if (
      normalized.includes("select") &&
      normalized.includes("academy_course_section_registrations") &&
      normalized.includes("pending_confirmation")
    ) {
      const [tenantId, sectionId, studentPersonId] = params;
      const rows = this.registrations.filter(
        (r) =>
          r.tenant_id === tenantId &&
          r.course_section_id === sectionId &&
          r.student_person_id === studentPersonId &&
          ["pending_confirmation", "registered", "waitlisted"].includes(String(r.status)),
      );
      return { rowCount: rows.length, rows };
    }

    // Get prerequisites
    if (normalized.includes("select cp.required_course_id") && normalized.includes("academy_course_prerequisites")) {
      const [tenantId, courseId] = params;
      const rows = this.prerequisites.filter(
        (p) => p.tenant_id === tenantId && p.course_id === courseId,
      );
      return { rowCount: rows.length, rows };
    }

    // Check completed prerequisite
    if (
      normalized.includes("select 1") &&
      normalized.includes("academy_course_section_registrations r") &&
      normalized.includes("completed")
    ) {
      const [tenantId, studentPersonId, requiredCourseId] = params;
      const rows = this.registrations.filter(
        (r) =>
          r.tenant_id === tenantId &&
          r.student_person_id === studentPersonId &&
          r.course_id === requiredCourseId &&
          r.status === "completed",
      );
      return { rowCount: rows.length, rows };
    }

    // Get student profile and period registration
    if (
      normalized.includes("select sp.id as student_profile_id") &&
      normalized.includes("academy_student_profiles sp")
    ) {
      const [tenantId, studentPersonId, academicPeriodId] = params;
      const profile = this.studentProfiles.find(
        (p) => p.tenant_id === tenantId && p.person_id === studentPersonId,
      );
      if (!profile) {
        return { rowCount: 0, rows: [] };
      }

      const periodReg = this.periodRegistrations.find(
        (pr) =>
          pr.tenant_id === tenantId &&
          pr.student_profile_id === profile.id &&
          pr.academic_period_id === academicPeriodId,
      );
      if (!periodReg) {
        return { rowCount: 0, rows: [] };
      }

      return {
        rowCount: 1,
        rows: [
          {
            student_profile_id: profile.id,
            period_registration_id: periodReg.id,
            program_enrollment_id: periodReg.program_enrollment_id,
          },
        ],
      };
    }

    // Insert registration
    if (normalized.includes("insert into academy_course_section_registrations")) {
      const [
        tenantId,
        studentProfileId,
        studentPersonId,
        programEnrollmentId,
        periodRegistrationId,
        courseSectionId,
      ] = params;
      const registration: Record<string, unknown> = {
        id: `reg-${this.registrations.length + 1}`,
        tenant_id: tenantId,
        student_profile_id: studentProfileId,
        student_person_id: studentPersonId,
        program_enrollment_id: programEnrollmentId,
        period_registration_id: periodRegistrationId,
        course_section_id: courseSectionId,
        status: "registered",
        registered_at: new Date(),
      };
      this.registrations.push(registration);
      return { rowCount: 1, rows: [registration] };
    }

    // Get registration for drop
    if (
      normalized.includes("select r.id, r.course_section_id") &&
      normalized.includes("academy_course_section_registrations r") &&
      normalized.includes("academy_course_sections s")
    ) {
      const [tenantId, registrationId] = params;
      const registration = this.registrations.find(
        (r) => r.tenant_id === tenantId && r.id === registrationId,
      );
      if (!registration) {
        return { rowCount: 0, rows: [] };
      }

      const section = this.sections.find(
        (s) => s.tenant_id === tenantId && s.id === registration.course_section_id,
      );
      const window = this.enrollmentWindows.find(
        (w) => w.tenant_id === tenantId && w.academic_period_id === section?.academic_period_id,
      );

      return {
        rowCount: 1,
        rows: [
          {
            ...registration,
            academic_period_id: section?.academic_period_id,
            enrollment_window_id: window?.id ?? null,
          },
        ],
      };
    }

    // Update registration to withdrawn
    if (normalized.includes("update academy_course_section_registrations")) {
      const [tenantId, registrationId] = params;
      const registration = this.registrations.find(
        (r) => r.tenant_id === tenantId && r.id === registrationId,
      );
      if (registration) {
        registration.status = "withdrawn";
      }
      return { rowCount: registration ? 1 : 0, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }

  addPrerequisite(courseId: string, requiredCourseId: string, requiredCourseCode: string) {
    this.prerequisites.push({
      tenant_id: "tenant-a",
      course_id: courseId,
      required_course_id: requiredCourseId,
      required_course_code: requiredCourseCode,
    });
  }

  addCompletedRegistration(studentPersonId: string, courseId: string) {
    this.registrations.push({
      id: `reg-completed-${this.registrations.length}`,
      tenant_id: "tenant-a",
      student_person_id: studentPersonId,
      course_id: courseId,
      status: "completed",
    });
  }

  addStudent(studentPersonId: string) {
    const profileId = `profile-${studentPersonId}`;
    this.studentProfiles.push({
      id: profileId,
      tenant_id: "tenant-a",
      person_id: studentPersonId,
    });
    this.periodRegistrations.push({
      id: `period-reg-${studentPersonId}`,
      tenant_id: "tenant-a",
      student_profile_id: profileId,
      program_enrollment_id: `program-enroll-${studentPersonId}`,
      academic_period_id: "period-1",
    });
  }

  setCapacity(sectionId: string, capacity: number) {
    const section = this.sections.find((s) => s.id === sectionId);
    if (section) {
      section.capacity = capacity;
    }
  }

  clearEnrollmentWindow() {
    this.enrollmentWindows = [];
  }

  getAuditEvents() {
    return this.auditEvents;
  }
}

describe("registerStudentForSection", () => {
  it("successfully registers a student", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();

    const result = await registerStudentForSection(
      actor,
      { sectionId: "section-123", studentPersonId: "student-123" },
      db,
    );

    assert.equal(result.courseSectionId, "section-123");
    assert.equal(result.studentPersonId, "student-123");
    assert.equal(result.status, "registered");
    assert.ok(result.registeredAt);
  });

  it("is idempotent: returns existing registration", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();

    const first = await registerStudentForSection(
      actor,
      { sectionId: "section-123", studentPersonId: "student-123" },
      db,
    );

    const second = await registerStudentForSection(
      actor,
      { sectionId: "section-123", studentPersonId: "student-123" },
      db,
    );

    assert.equal(first.id, second.id);
  });

  it("rejects a student registering another student", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();
    db.addStudent("student-456");

    await assert.rejects(
      async () => {
        await registerStudentForSection(
          actor,
          { sectionId: "section-123", studentPersonId: "student-456" },
          db,
        );
      },
      { message: /students can only register themselves/i },
    );
  });

  it("locks the section row before checking capacity", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();

    await registerStudentForSection(
      actor,
      { sectionId: "section-123", studentPersonId: "student-123" },
      db,
    );

    assert.ok(
      db.queries.some((sql) => /from academy_course_sections s[\s\S]*for update/i.test(sql)),
      "expected registration flow to lock the section row with FOR UPDATE",
    );
  });

  it("throws error when capacity is full", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();
    db.setCapacity("section-123", 0);

    await assert.rejects(
      async () => {
        await registerStudentForSection(
          actor,
          { sectionId: "section-123", studentPersonId: "student-123" },
          db,
        );
      },
      { message: /at capacity/ },
    );
  });

  it("throws error when prerequisite is not met", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();
    db.addPrerequisite("course-1", "prereq-course", "PREREQ101");

    await assert.rejects(
      async () => {
        await registerStudentForSection(
          actor,
          { sectionId: "section-123", studentPersonId: "student-123" },
          db,
        );
      },
      { message: /Prerequisite not met/ },
    );
  });

  it("allows registration when prerequisite is completed", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();
    db.addPrerequisite("course-1", "prereq-course", "PREREQ101");
    db.addCompletedRegistration("student-123", "prereq-course");

    const result = await registerStudentForSection(
      actor,
      { sectionId: "section-123", studentPersonId: "student-123" },
      db,
    );

    assert.equal(result.status, "registered");
  });

  it("throws error when enrollment window is closed for student", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();
    db.clearEnrollmentWindow();

    await assert.rejects(
      async () => {
        await registerStudentForSection(
          actor,
          { sectionId: "section-123", studentPersonId: "student-123" },
          db,
        );
      },
      { message: /Registration window is not open/ },
    );
  });

  it("allows registrar to register outside enrollment window", async () => {
    const actor: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-a",
      roles: ["registrar"],
    };
    const db = new MockDatabase();
    db.clearEnrollmentWindow();

    const input = {
      sectionId: "section-123",
      studentPersonId: "student-123",
      overrideReason: "Late registration approved by registrar.",
    };
    const result = await registerStudentForSection(
      actor,
      input,
      db,
    );

    assert.equal(result.status, "registered");
    assert.equal(db.getAuditEvents().length, 1);
    assert.deepEqual(
      (db.getAuditEvents()[0].redacted_metadata as Record<string, unknown>).reason,
      "Late registration approved by registrar.",
    );
  });

  it("requires registrar override reason outside enrollment window", async () => {
    const actor: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-a",
      roles: ["registrar"],
    };
    const db = new MockDatabase();
    db.clearEnrollmentWindow();

    await assert.rejects(
      async () => {
        await registerStudentForSection(
          actor,
          { sectionId: "section-123", studentPersonId: "student-123" },
          db,
        );
      },
      { message: /overrideReason is required/i },
    );
  });

  it("throws error for cross-tenant access", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-b",
      roles: ["student"],
    };
    const db = new MockDatabase();

    await assert.rejects(
      async () => {
        await registerStudentForSection(
          actor,
          { sectionId: "section-123", studentPersonId: "student-123" },
          db,
        );
      },
      { message: /Cross-tenant access is forbidden/ },
    );
  });
});

describe("dropStudentFromSection", () => {
  it("successfully drops a registration", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();

    const registration = await registerStudentForSection(
      actor,
      { sectionId: "section-123", studentPersonId: "student-123" },
      db,
    );

    await dropStudentFromSection(actor, { registrationId: registration.id }, db);

    // No error means success
    assert.ok(true);
  });

  it("throws error when enrollment window is closed for student", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();

    const registration = await registerStudentForSection(
      actor,
      { sectionId: "section-123", studentPersonId: "student-123" },
      db,
    );

    db.clearEnrollmentWindow();

    await assert.rejects(
      async () => {
        await dropStudentFromSection(actor, { registrationId: registration.id }, db);
      },
      { message: /Add\/drop window is not open/ },
    );
  });

  it("allows registrar to drop outside enrollment window", async () => {
    const actorStudent: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const actorRegistrar: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-a",
      roles: ["registrar"],
    };
    const db = new MockDatabase();

    const registration = await registerStudentForSection(
      actorStudent,
      { sectionId: "section-123", studentPersonId: "student-123" },
      db,
    );

    db.clearEnrollmentWindow();

    await dropStudentFromSection(
      actorRegistrar,
      { registrationId: registration.id, overrideReason: "Registrar-approved late drop." },
      db,
    );

    assert.ok(true);
    assert.equal(db.getAuditEvents().length, 1);
  });

  it("requires registrar override reason to drop outside enrollment window", async () => {
    const actorStudent: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const actorRegistrar: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-a",
      roles: ["registrar"],
    };
    const db = new MockDatabase();

    const registration = await registerStudentForSection(
      actorStudent,
      { sectionId: "section-123", studentPersonId: "student-123" },
      db,
    );

    db.clearEnrollmentWindow();

    await assert.rejects(
      async () => {
        await dropStudentFromSection(actorRegistrar, { registrationId: registration.id }, db);
      },
      { message: /overrideReason is required/i },
    );
  });
});
