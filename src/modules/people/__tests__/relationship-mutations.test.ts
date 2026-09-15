import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createStudentRelationship, updateStudentRelationship, deactivateStudentRelationship, CreateRelationshipInput, UpdateRelationshipInput } from "../relationship-mutations";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  private people = new Map<string, Record<string, unknown>>();
  private relationships = new Map<string, Record<string, unknown>>();
  private auditEvents: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const lowerSql = sql.toLowerCase();

    if (lowerSql.includes("select id, person_status from academy_people")) {
      const person = Array.from(this.people.values()).find(
        (p) => p.tenant_id === params[0] && p.id === params[1]
      );
      return { rowCount: person ? 1 : 0, rows: person ? [{ id: person.id, person_status: person.person_status }] : [] };
    }

    if (lowerSql.includes("insert into academy_student_relationships")) {
      const id = String(params[0]);
      const row = {
        id,
        tenant_id: params[1],
        student_person_id: params[2],
        related_person_id: params[3],
        relationship_type: params[4],
        authority: params[5],
        visibility: params[6],
        status: "active",
        starts_on: params[7],
        ends_on: params[8],
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.relationships.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

    if (lowerSql.includes("select id, tenant_id, student_person_id") && lowerSql.includes("from academy_student_relationships")) {
      const rel = this.relationships.get(String(params[1]));
      if (!rel || rel.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [rel] };
    }

    if (lowerSql.includes("update academy_student_relationships set") && lowerSql.includes("authority")) {
      const relId = String(params[1]);
      const rel = this.relationships.get(relId);
      if (!rel || rel.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }

      const updated = { ...rel, updated_at: new Date() };
      this.relationships.set(relId, updated);
      return { rowCount: 1, rows: [updated] };
    }

    if (lowerSql.includes("select id, status from academy_student_relationships")) {
      const rel = this.relationships.get(String(params[1]));
      if (!rel || rel.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [{ id: rel.id, status: rel.status }] };
    }

    if (lowerSql.includes("update academy_student_relationships set status")) {
      const relId = String(params[1]);
      const rel = this.relationships.get(relId);
      if (!rel || rel.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }

      const updated = { ...rel, status: "inactive", updated_at: new Date() };
      this.relationships.set(relId, updated);
      return { rowCount: 1, rows: [updated] };
    }

    if (lowerSql.includes("insert into academy_audit_events")) {
      this.auditEvents.push({ tenant_id: params[0], actor_person_id: params[1], action: params[2] });
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }

  addPerson(id: string, tenantId: string, personStatus = "active") {
    this.people.set(id, { id, tenant_id: tenantId, person_status: personStatus });
  }
}

describe("Relationship Mutations", () => {
  const tenantId = "tenant-123";
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId,
    roles: ["institution_admin"],
  };

  test("createStudentRelationship: success (guardian)", async () => {
    const db = new MockDatabase();
    const studentId = "student-123";
    const guardianId = "guardian-123";
    db.addPerson(studentId, tenantId);
    db.addPerson(guardianId, tenantId);

    const input: CreateRelationshipInput = {
      studentPersonId: studentId,
      relatedPersonId: guardianId,
      relationshipType: "guardian",
      authority: "registration_decision",
      visibility: "full_guardian",
    };

    const result = await createStudentRelationship(actor, input, db);

    assert.strictEqual(result.studentPersonId, studentId);
    assert.strictEqual(result.relatedPersonId, guardianId);
    assert.strictEqual(result.relationshipType, "guardian");
    assert.doesNotMatch(JSON.stringify(result), /credentialSecret|accessToken|refreshToken|password/);
  });

  test("createStudentRelationship: emergency contact with academic_decision rejected", async () => {
    const db = new MockDatabase();
    const studentId = "student-123";
    const contactId = "contact-123";
    db.addPerson(studentId, tenantId);
    db.addPerson(contactId, tenantId);

    const input: CreateRelationshipInput = {
      studentPersonId: studentId,
      relatedPersonId: contactId,
      relationshipType: "emergency_contact",
      authority: "academic_decision",
      visibility: "directory_only",
    };

    await assert.rejects(
      async () => createStudentRelationship(actor, input, db),
      /Emergency contacts cannot have academic or registration decision authority/
    );
  });

  test("createStudentRelationship: pickup_contact with full_guardian visibility rejected", async () => {
    const db = new MockDatabase();
    const studentId = "student-123";
    const contactId = "contact-123";
    db.addPerson(studentId, tenantId);
    db.addPerson(contactId, tenantId);

    const input: CreateRelationshipInput = {
      studentPersonId: studentId,
      relatedPersonId: contactId,
      relationshipType: "pickup_contact",
      authority: "pickup_authorized",
      visibility: "full_guardian",
    };

    await assert.rejects(
      async () => createStudentRelationship(actor, input, db),
      /Contact-only relationships cannot use guardian-level visibility/
    );
  });

  test("createStudentRelationship: cross-tenant rejection", async () => {
    const db = new MockDatabase();
    const studentId = "student-123";
    const contactId = "contact-123";
    db.addPerson(studentId, "other-tenant");
    db.addPerson(contactId, tenantId);

    const input: CreateRelationshipInput = {
      studentPersonId: studentId,
      relatedPersonId: contactId,
      relationshipType: "guardian",
      authority: "view_only",
      visibility: "directory_only",
    };

    await assert.rejects(
      async () => createStudentRelationship(actor, input, db),
      /Cross-tenant/
    );
  });

  test("updateStudentRelationship: authority change with reason success", async () => {
    const db = new MockDatabase();
    const studentId = "student-123";
    const guardianId = "guardian-123";
    db.addPerson(studentId, tenantId);
    db.addPerson(guardianId, tenantId);

    const rel = await createStudentRelationship(actor, {
      studentPersonId: studentId,
      relatedPersonId: guardianId,
      relationshipType: "guardian",
      authority: "view_only",
      visibility: "directory_only",
    }, db);

    const updateInput: UpdateRelationshipInput = {
      authority: "registration_decision",
      reason: "Granted full decision authority",
    };

    const updated = await updateStudentRelationship(actor, rel.id, updateInput, db);
    assert.ok(updated);
    assert.doesNotMatch(JSON.stringify(updated), /credentialSecret|accessToken|refreshToken|password/);
  });

  test("updateStudentRelationship: authority change without reason rejected", async () => {
    const db = new MockDatabase();
    const studentId = "student-123";
    const guardianId = "guardian-123";
    db.addPerson(studentId, tenantId);
    db.addPerson(guardianId, tenantId);

    const rel = await createStudentRelationship(actor, {
      studentPersonId: studentId,
      relatedPersonId: guardianId,
      relationshipType: "guardian",
      authority: "view_only",
      visibility: "directory_only",
    }, db);

    const updateInput: UpdateRelationshipInput = {
      authority: "registration_decision",
    };

    await assert.rejects(
      async () => updateStudentRelationship(actor, rel.id, updateInput, db),
      /Reason is required when changing relationship authority/
    );
  });

  test("deactivateStudentRelationship: success", async () => {
    const db = new MockDatabase();
    const studentId = "student-123";
    const guardianId = "guardian-123";
    db.addPerson(studentId, tenantId);
    db.addPerson(guardianId, tenantId);

    const rel = await createStudentRelationship(actor, {
      studentPersonId: studentId,
      relatedPersonId: guardianId,
      relationshipType: "guardian",
      authority: "view_only",
      visibility: "directory_only",
    }, db);

    await deactivateStudentRelationship(actor, rel.id, "Student graduated", db);
    assert.ok(true);
  });

  test("deactivateStudentRelationship: missing reason rejected", async () => {
    const db = new MockDatabase();
    const studentId = "student-123";
    const guardianId = "guardian-123";
    db.addPerson(studentId, tenantId);
    db.addPerson(guardianId, tenantId);

    const rel = await createStudentRelationship(actor, {
      studentPersonId: studentId,
      relatedPersonId: guardianId,
      relationshipType: "guardian",
      authority: "view_only",
      visibility: "directory_only",
    }, db);

    await assert.rejects(
      async () => deactivateStudentRelationship(actor, rel.id, "", db),
      /Reason for deactivation is required/
    );
  });
});
