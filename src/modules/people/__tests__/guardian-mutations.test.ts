import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createGuardianWithLink, CreateGuardianWithLinkInput } from "../guardian-mutations";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  private people = new Map<string, Record<string, unknown>>();
  private relationships = new Map<string, Record<string, unknown>>();
  private roleAssignments = new Map<string, Record<string, unknown>>();
  private auditEvents: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const lowerSql = sql.toLowerCase();

    if (lowerSql.includes("select id from academy_people where tenant_id") && params.length === 2) {
      const person = Array.from(this.people.values()).find(
        (p) => p.tenant_id === params[0] && p.id === params[1]
      );
      return { rowCount: person ? 1 : 0, rows: person ? [person] : [] };
    }

    if (lowerSql.includes("select id from academy_people") && lowerSql.includes("lower(email)")) {
      const email = String(params[1]).toLowerCase();
      const existing = Array.from(this.people.values()).find(
        (p) => p.tenant_id === params[0] && String(p.email).toLowerCase() === email
      );
      return { rowCount: existing ? 1 : 0, rows: existing ? [existing] : [] };
    }

    if (lowerSql.includes("insert into academy_people")) {
      const id = String(params[0]);
      const row = {
        id,
        tenant_id: params[1],
        display_name: params[2],
        given_name: params[3],
        family_name: params[4],
        preferred_name: params[5],
        email: params[6],
        phone: params[7],
        date_of_birth: params[8],
        person_status: params[9],
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.people.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

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

    if (lowerSql.includes("insert into academy_person_role_assignments")) {
      const id = String(params[0]);
      const row = {
        id,
        tenant_id: params[1],
        person_id: params[2],
        role: "guardian", // hard-coded in SQL
        scope_type: "student", // hard-coded in SQL
        scope_id: params[3],
        status: "active", // hard-coded in SQL
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.roleAssignments.set(id, row);
      return { rowCount: 1, rows: [] };
    }

    if (lowerSql.includes("insert into academy_audit_events")) {
      this.auditEvents.push({ tenant_id: params[0], actor_person_id: params[1], action: params[2] });
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }

  addPerson(id: string, tenantId: string) {
    this.people.set(id, { id, tenant_id: tenantId, person_status: "active" });
  }

  getRoleAssignments() {
    return Array.from(this.roleAssignments.values());
  }
}

describe("Guardian Mutations", () => {
  const tenantId = "tenant-123";
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId,
    roles: ["institution_admin"],
  };

  test("createGuardianWithLink: success (creates person + relationship + role)", async () => {
    const db = new MockDatabase();
    const studentId = "student-123";
    db.addPerson(studentId, tenantId);

    const input: CreateGuardianWithLinkInput = {
      displayName: "Jane Guardian",
      givenName: "Jane",
      familyName: "Guardian",
      email: "jane.guardian@test.com",
      studentPersonId: studentId,
      relationshipType: "guardian",
      authority: "registration_decision",
      visibility: "full_guardian",
    };

    const result = await createGuardianWithLink(actor, input, db);

    assert.strictEqual(result.person.displayName, "Jane Guardian");
    assert.strictEqual(result.relationship.studentPersonId, studentId);
    assert.strictEqual(result.relationship.relationshipType, "guardian");
    
    const roles = db.getRoleAssignments();
    assert.strictEqual(roles.length, 1);
    assert.strictEqual(roles[0].role, "guardian");
    assert.strictEqual(roles[0].scope_type, "student");
    assert.strictEqual(roles[0].scope_id, studentId);

    assert.doesNotMatch(JSON.stringify(result), /credentialSecret|accessToken|refreshToken|password/);
  });

  test("createGuardianWithLink: invalid student reference rejected", async () => {
    const db = new MockDatabase();

    const input: CreateGuardianWithLinkInput = {
      displayName: "Jane Guardian",
      studentPersonId: "nonexistent-student",
      relationshipType: "guardian",
      authority: "view_only",
      visibility: "directory_only",
    };

    await assert.rejects(
      async () => createGuardianWithLink(actor, input, db),
      /Student not found/
    );
  });

  test("createGuardianWithLink: cross-tenant rejection", async () => {
    const db = new MockDatabase();
    const studentId = "student-123";
    db.addPerson(studentId, "other-tenant");

    const input: CreateGuardianWithLinkInput = {
      displayName: "Jane Guardian",
      studentPersonId: studentId,
      relationshipType: "guardian",
      authority: "view_only",
      visibility: "directory_only",
    };

    await assert.rejects(
      async () => createGuardianWithLink(actor, input, db),
      /Student not found/
    );
  });
});
