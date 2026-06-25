import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addAdvisorNote,
  updateEnrollmentStatus,
  addHold,
  clearHold,
  listHolds,
  listAdvisorNotes,
  updateStudentProfile,
  updateStudentEnrollmentFields,
} from "@/modules/people/student-record-mutations";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  private notes: Record<string, unknown>[] = [];
  private holds: Record<string, unknown>[] = [];
  private people: Record<string, unknown>[] = [];
  private studentProfiles: Record<string, unknown>[] = [];
  private auditEvents: Record<string, unknown>[] = [];

  constructor() {
    this.people.push({
      id: "student-123",
      tenant_id: "tenant-a",
      preferred_name: "Alex",
      phone: "555-0100",
      email: "alex@example.com",
      address_street: null,
      address_city: null,
      address_state: null,
      address_postal_code: null,
      address_country: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      emergency_contact_relationship: null,
    });
    this.studentProfiles.push({
      id: "profile-123",
      tenant_id: "tenant-a",
      person_id: "student-123",
      enrollment_status: "active",
      program_id: "program-1",
      advisor_person_id: "advisor-1",
    });
  }

  async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const normalized = sql.toLowerCase().trim();

    // Select from academy_people
    if (normalized.includes("select") && normalized.includes("academy_people") && !normalized.includes("update")) {
      const tenantId = params[0];
      const personId = params[1];
      const rows = this.people.filter(
        (p) => p.tenant_id === tenantId && p.id === personId,
      );
      return { rowCount: rows.length, rows };
    }

    // Update academy_people
    if (normalized.includes("update academy_people")) {
      const [tenantId, personId] = params;
      const person = this.people.find((p) => p.tenant_id === tenantId && p.id === personId);
      if (person) {
        // Apply updates (simplified - real implementation parses SET clause)
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    }

    // Select from academy_student_profiles
    if (normalized.includes("select") && normalized.includes("academy_student_profiles")) {
      const tenantId = params[0];
      const personId = params[1];
      const rows = this.studentProfiles.filter(
        (p) => p.tenant_id === tenantId && p.person_id === personId,
      );
      return { rowCount: rows.length, rows };
    }

    // Update academy_student_profiles
    if (normalized.includes("update academy_student_profiles")) {
      const [tenantId, personId] = params;
      const profile = this.studentProfiles.find(
        (p) => p.tenant_id === tenantId && p.person_id === personId,
      );
      if (profile) {
        // Apply updates from params (simplified)
        if (params[2]) {
          if (normalized.includes("enrollment_status")) {
            profile.enrollment_status = params[2];
            profile.enrollment_status_override = params[2];
          } else if (normalized.includes("program_id")) {
            profile.program_id = params[2];
          } else if (normalized.includes("advisor_person_id")) {
            profile.advisor_person_id = params[2];
          }
        }
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    }

    // Insert advisor note
    if (normalized.includes("insert into academy_advisor_notes")) {
      const [tenantId, studentPersonId, authorPersonId, noteText, noteType, visibleToStudent] = params;
      const note: Record<string, unknown> = {
        id: `note-${this.notes.length + 1}`,
        tenant_id: tenantId,
        student_person_id: studentPersonId,
        author_person_id: authorPersonId,
        note_text: noteText,
        note_type: noteType,
        visible_to_student: visibleToStudent,
        created_at: new Date(),
      };
      this.notes.push(note);
      return { rowCount: 1, rows: [note] };
    }

    // Select advisor notes
    if (normalized.includes("select") && normalized.includes("academy_advisor_notes")) {
      const [tenantId, studentPersonId] = params;
      let rows = this.notes.filter(
        (n) => n.tenant_id === tenantId && n.student_person_id === studentPersonId,
      );
      // Filter by visible_to_student if query includes that condition
      if (normalized.includes("visible_to_student = true")) {
        rows = rows.filter((n) => n.visible_to_student === true);
      }
      return { rowCount: rows.length, rows };
    }

    // Insert audit event
    if (normalized.includes("insert into academy_audit_events")) {
      const [tenantId, actorPersonId, action, entityType, entityId, resultStatus, metadata] = params;
      const event: Record<string, unknown> = {
        id: `audit-${this.auditEvents.length + 1}`,
        tenant_id: tenantId,
        actor_person_id: actorPersonId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        result_status: resultStatus,
        redacted_metadata: typeof metadata === "string" ? JSON.parse(metadata) : metadata,
        occurred_at: new Date(),
      };
      this.auditEvents.push(event);
      return { rowCount: 1, rows: [event] };
    }

    // Insert hold
    if (normalized.includes("insert into academy_student_holds")) {
      const [tenantId, studentPersonId, holdType, note, addedByPersonId] = params;
      const hold: Record<string, unknown> = {
        id: `hold-${this.holds.length + 1}`,
        tenant_id: tenantId,
        student_person_id: studentPersonId,
        hold_type: holdType,
        note,
        added_by_person_id: addedByPersonId,
        added_at: new Date(),
        cleared_by_person_id: null,
        cleared_at: null,
        resolution_note: null,
      };
      this.holds.push(hold);
      return { rowCount: 1, rows: [hold] };
    }

    // Select holds (with filter)
    if (normalized.includes("select") && normalized.includes("academy_student_holds")) {
      const [tenantId, studentPersonId] = params;
      let rows = this.holds.filter(
        (h) => h.tenant_id === tenantId && h.student_person_id === studentPersonId,
      );
      // If query includes "cleared_at is null", filter active holds
      if (normalized.includes("cleared_at is null")) {
        rows = rows.filter((h) => h.cleared_at === null);
      }
      return { rowCount: rows.length, rows };
    }

    // Update hold (clear)
    if (normalized.includes("update academy_student_holds")) {
      const [tenantId, holdId, clearedBy, resolutionNote] = params;
      const hold = this.holds.find((h) => h.tenant_id === tenantId && h.id === holdId);
      if (hold) {
        hold.cleared_by_person_id = clearedBy;
        hold.cleared_at = new Date();
        hold.resolution_note = resolutionNote;
        return { rowCount: 1, rows: [hold] };
      }
      return { rowCount: 0, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }

  getAuditEvents(): Record<string, unknown>[] {
    return this.auditEvents;
  }
}

describe("addAdvisorNote", () => {
  it("creates an advisor note successfully with note type and visibility", async () => {
    const actor: AcademyActor = {
      userId: "advisor-1",
      tenantId: "tenant-a",
      roles: ["advisor"],
    };
    const db = new MockDatabase();

    const result = await addAdvisorNote(
      actor,
      { studentPersonId: "student-123", noteText: "Student is progressing well.", noteType: "academic", visibleToStudent: false },
      db,
    );

    assert.equal(result.studentPersonId, "student-123");
    assert.equal(result.authorPersonId, "advisor-1");
    assert.equal(result.noteText, "Student is progressing well.");
    assert.equal(result.noteType, "academic");
    assert.equal(result.visibleToStudent, false);
    assert.ok(result.createdAt);
  });

  it("throws error when cross-tenant access is attempted", async () => {
    const actor: AcademyActor = {
      userId: "advisor-1",
      tenantId: "tenant-b",
      roles: ["advisor"],
    };
    const db = new MockDatabase();

    await assert.rejects(
      async () => {
        await addAdvisorNote(
          actor,
          { studentPersonId: "student-123", noteText: "Note text", noteType: "general" },
          db,
        );
      },
      { message: /Cross-tenant access is forbidden/ },
    );
  });

  it("throws error when unauthorized role attempts to add note", async () => {
    const actor: AcademyActor = {
      userId: "student-456",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();

    await assert.rejects(
      async () => {
        await addAdvisorNote(
          actor,
          { studentPersonId: "student-123", noteText: "Note text", noteType: "general" },
          db,
        );
      },
      { message: /Forbidden: add advisor note/ },
    );
  });
});

describe("updateEnrollmentStatus", () => {
  it("updates enrollment status successfully and emits audit event", async () => {
    const actor: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-a",
      roles: ["registrar"],
    };
    const db = new MockDatabase();

    await updateEnrollmentStatus(
      actor,
      {
        studentPersonId: "student-123",
        newStatus: "withdrawn",
        reason: "Student requested withdrawal",
      },
      db,
    );

    // Check audit event was created
    const auditEvents = db.getAuditEvents();
    assert.equal(auditEvents.length, 1);
    assert.equal(auditEvents[0].action, "update_enrollment_status");
    const metadata = auditEvents[0].redacted_metadata as Record<string, unknown>;
    assert.equal(metadata.field, "enrollment_status");
    assert.equal(metadata.new_value, "withdrawn");
    assert.equal(metadata.reason, "Student requested withdrawal");
    assert.ok(metadata.old_value_hash);
    // Verify old_value_hash is not plaintext
    assert.doesNotMatch(String(metadata.old_value_hash), /active/);
  });

  it("throws error when unauthorized role attempts status update", async () => {
    const actor: AcademyActor = {
      userId: "advisor-1",
      tenantId: "tenant-a",
      roles: ["advisor"],
    };
    const db = new MockDatabase();

    await assert.rejects(
      async () => {
        await updateEnrollmentStatus(
          actor,
          { studentPersonId: "student-123", newStatus: "withdrawn", reason: "Some reason" },
          db,
        );
      },
      { message: /Forbidden: update enrollment status/ },
    );
  });
});

describe("addHold", () => {
  it("creates a hold successfully", async () => {
    const actor: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-a",
      roles: ["registrar"],
    };
    const db = new MockDatabase();

    const result = await addHold(
      actor,
      {
        studentPersonId: "student-123",
        holdType: "financial",
        note: "Unpaid tuition balance",
      },
      db,
    );

    assert.equal(result.studentPersonId, "student-123");
    assert.equal(result.holdType, "financial");
    assert.equal(result.note, "Unpaid tuition balance");
    assert.ok(result.addedAt);
    assert.equal(result.clearedAt, undefined);
  });

  it("throws error for cross-tenant access", async () => {
    const actor: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-b",
      roles: ["registrar"],
    };
    const db = new MockDatabase();

    await assert.rejects(
      async () => {
        await addHold(
          actor,
          { studentPersonId: "student-123", holdType: "academic", note: "Some note" },
          db,
        );
      },
      { message: /Cross-tenant access is forbidden/ },
    );
  });
});

describe("clearHold", () => {
  it("clears a hold successfully", async () => {
    const actor: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-a",
      roles: ["registrar"],
    };
    const db = new MockDatabase();

    // First create a hold
    const hold = await addHold(
      actor,
      { studentPersonId: "student-123", holdType: "financial", note: "Balance due" },
      db,
    );

    // Now clear it
    const result = await clearHold(
      actor,
      { holdId: hold.id, resolutionNote: "Payment received" },
      db,
    );

    assert.ok(result.clearedAt);
    assert.equal(result.resolutionNote, "Payment received");
    assert.equal(result.clearedByPersonId, "registrar-1");
  });

  it("throws error when resolution note is missing", async () => {
    const actor: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-a",
      roles: ["registrar"],
    };
    const db = new MockDatabase();

    const hold = await addHold(
      actor,
      { studentPersonId: "student-123", holdType: "financial", note: "Balance due" },
      db,
    );

    await assert.rejects(
      async () => {
        await clearHold(actor, { holdId: hold.id, resolutionNote: "" }, db);
      },
      { message: /Resolution note is required/ },
    );
  });
});

describe("listHolds", () => {
  it("returns only active (uncleared) holds by default", async () => {
    const actor: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-a",
      roles: ["registrar"],
    };
    const db = new MockDatabase();

    // Add two holds
    const hold1 = await addHold(
      actor,
      { studentPersonId: "student-123", holdType: "financial", note: "Balance 1" },
      db,
    );
    const hold2 = await addHold(
      actor,
      { studentPersonId: "student-123", holdType: "academic", note: "Balance 2" },
      db,
    );

    // Clear one
    await clearHold(actor, { holdId: hold1.id, resolutionNote: "Resolved" }, db);

    // List active holds
    const activeHolds = await listHolds(actor, "student-123", db, true);
    assert.equal(activeHolds.length, 1);
    assert.equal(activeHolds[0].id, hold2.id);
  });
});

describe("listAdvisorNotes", () => {
  it("staff can see all notes", async () => {
    const actor: AcademyActor = {
      userId: "advisor-1",
      tenantId: "tenant-a",
      roles: ["advisor"],
    };
    const db = new MockDatabase();

    await addAdvisorNote(actor, { studentPersonId: "student-123", noteText: "Visible note", noteType: "academic", visibleToStudent: true }, db);
    await addAdvisorNote(actor, { studentPersonId: "student-123", noteText: "Hidden note", noteType: "pastoral", visibleToStudent: false }, db);

    const notes = await listAdvisorNotes(actor, "student-123", db);
    assert.equal(notes.length, 2);
  });

  it("student can only see notes where visible_to_student=true", async () => {
    const advisorActor: AcademyActor = {
      userId: "advisor-1",
      tenantId: "tenant-a",
      roles: ["advisor"],
    };
    const db = new MockDatabase();

    await addAdvisorNote(advisorActor, { studentPersonId: "student-123", noteText: "Visible note", noteType: "academic", visibleToStudent: true }, db);
    await addAdvisorNote(advisorActor, { studentPersonId: "student-123", noteText: "Hidden note", noteType: "pastoral", visibleToStudent: false }, db);

    const studentActor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };

    const notes = await listAdvisorNotes(studentActor, "student-123", db);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].noteText, "Visible note");
  });

  it("guardian cannot access advisor notes", async () => {
    const guardianActor: AcademyActor = {
      userId: "guardian-1",
      tenantId: "tenant-a",
      roles: ["guardian"],
    };
    const db = new MockDatabase();

    await assert.rejects(
      async () => {
        await listAdvisorNotes(guardianActor, "student-123", db);
      },
      { message: /Forbidden: guardians cannot access advisor notes/ },
    );
  });
});

describe("updateStudentProfile", () => {
  it("student can update own profile and audit event is emitted", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();

    await updateStudentProfile(
      actor,
      "student-123",
      { preferredName: "Alexandra", phone: "555-0200" },
      db,
    );

    const auditEvents = db.getAuditEvents();
    // Should have 2 audit events (one for each field change)
    assert.ok(auditEvents.length >= 1);
    const preferredNameEvent = auditEvents.find((e) => {
      const metadata = e.redacted_metadata as Record<string, unknown>;
      return metadata.field_changed === "preferred_name";
    });
    assert.ok(preferredNameEvent);
    const metadata = preferredNameEvent!.redacted_metadata as Record<string, unknown>;
    assert.equal(metadata.new_value, "Alexandra");
    assert.ok(metadata.old_value_hash);
    // Verify old_value_hash is not plaintext
    assert.doesNotMatch(String(metadata.old_value_hash), /Alex/);
  });

  it("student cannot update another student's profile", async () => {
    const actor: AcademyActor = {
      userId: "student-456",
      tenantId: "tenant-a",
      roles: ["student"],
    };
    const db = new MockDatabase();

    await assert.rejects(
      async () => {
        await updateStudentProfile(actor, "student-123", { preferredName: "Hacker" }, db);
      },
      { message: /Forbidden: students can only update their own profile/ },
    );
  });

  it("cross-tenant access is forbidden", async () => {
    const actor: AcademyActor = {
      userId: "student-123",
      tenantId: "tenant-b",
      roles: ["student"],
    };
    const db = new MockDatabase();

    await assert.rejects(
      async () => {
        await updateStudentProfile(actor, "student-123", { preferredName: "Alex" }, db);
      },
      { message: /Cross-tenant access is forbidden/ },
    );
  });
});

describe("updateStudentEnrollmentFields", () => {
  it("registrar can update enrollment fields with reason", async () => {
    const actor: AcademyActor = {
      userId: "registrar-1",
      tenantId: "tenant-a",
      roles: ["registrar"],
    };
    const db = new MockDatabase();

    await updateStudentEnrollmentFields(
      actor,
      "student-123",
      { programId: "program-2", advisorPersonId: "advisor-2" },
      "Student changed major",
      db,
    );

    const auditEvents = db.getAuditEvents();
    // Should have 2 audit events (one for each field)
    assert.ok(auditEvents.length >= 1);
    const programEvent = auditEvents.find((e) => {
      const metadata = e.redacted_metadata as Record<string, unknown>;
      return metadata.field_changed === "program_id";
    });
    assert.ok(programEvent);
    const metadata = programEvent!.redacted_metadata as Record<string, unknown>;
    assert.equal(metadata.new_value, "program-2");
    assert.equal(metadata.reason, "Student changed major");
  });

  it("advisor cannot update enrollment fields", async () => {
    const actor: AcademyActor = {
      userId: "advisor-1",
      tenantId: "tenant-a",
      roles: ["advisor"],
    };
    const db = new MockDatabase();

    await assert.rejects(
      async () => {
        await updateStudentEnrollmentFields(
          actor,
          "student-123",
          { programId: "program-2" },
          "Some reason",
          db,
        );
      },
      { message: /Forbidden: update student enrollment fields/ },
    );
  });
});
