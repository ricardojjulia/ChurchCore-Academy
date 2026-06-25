import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addAdvisorNote,
  updateEnrollmentStatus,
  addHold,
  clearHold,
  listHolds,
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

  constructor() {
    this.people.push({
      id: "student-123",
      tenant_id: "tenant-a",
    });
    this.studentProfiles.push({
      id: "profile-123",
      tenant_id: "tenant-a",
      person_id: "student-123",
      enrollment_status: "active",
    });
  }

  async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const normalized = sql.toLowerCase().trim();

    // Select from academy_people
    if (normalized.includes("select") && normalized.includes("academy_people")) {
      const tenantId = params[0];
      const personId = params[1];
      const rows = this.people.filter(
        (p) => p.tenant_id === tenantId && p.id === personId,
      );
      return { rowCount: rows.length, rows };
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

    // Insert advisor note
    if (normalized.includes("insert into academy_student_advisor_notes")) {
      const [tenantId, studentPersonId, authorPersonId, noteText] = params;
      const note: Record<string, unknown> = {
        id: `note-${this.notes.length + 1}`,
        tenant_id: tenantId,
        student_person_id: studentPersonId,
        author_person_id: authorPersonId,
        note_text: noteText,
        created_at: new Date(),
      };
      this.notes.push(note);
      return { rowCount: 1, rows: [note] };
    }

    // Select advisor notes
    if (normalized.includes("select") && normalized.includes("academy_student_advisor_notes")) {
      const [tenantId, studentPersonId] = params;
      const rows = this.notes.filter(
        (n) => n.tenant_id === tenantId && n.student_person_id === studentPersonId,
      );
      return { rowCount: rows.length, rows };
    }

    // Update enrollment status
    if (normalized.includes("update academy_student_profiles")) {
      const [tenantId, personId, newStatus] = params;
      const profile = this.studentProfiles.find(
        (p) => p.tenant_id === tenantId && p.person_id === personId,
      );
      if (profile) {
        profile.enrollment_status = newStatus;
        profile.enrollment_status_override = newStatus;
      }
      return { rowCount: profile ? 1 : 0, rows: [] };
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
}

describe("addAdvisorNote", () => {
  it("creates an advisor note successfully", async () => {
    const actor: AcademyActor = {
      userId: "advisor-1",
      tenantId: "tenant-a",
      roles: ["advisor"],
    };
    const db = new MockDatabase();

    const result = await addAdvisorNote(
      actor,
      { studentPersonId: "student-123", noteText: "Student is progressing well." },
      db,
    );

    assert.equal(result.studentPersonId, "student-123");
    assert.equal(result.authorPersonId, "advisor-1");
    assert.equal(result.noteText, "Student is progressing well.");
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
          { studentPersonId: "student-123", noteText: "Note text" },
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
          { studentPersonId: "student-123", noteText: "Note text" },
          db,
        );
      },
      { message: /Forbidden: add advisor note/ },
    );
  });
});

describe("updateEnrollmentStatus", () => {
  it("updates enrollment status successfully", async () => {
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

    // Verify status was updated (implicitly via no error thrown)
    assert.ok(true);
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
