import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createPerson, updatePersonFields, archivePerson, CreatePersonInput, UpdatePersonInput } from "../person-mutations";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  private people = new Map<string, Record<string, unknown>>();
  private studentProfiles = new Map<string, Record<string, unknown>>();
  private staffProfiles = new Map<string, Record<string, unknown>>();
  private auditEvents: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const lowerSql = sql.toLowerCase();

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

    if (lowerSql.includes("select id, tenant_id, display_name") && lowerSql.includes("from academy_people where tenant_id")) {
      const person = this.people.get(String(params[1]));
      if (!person || person.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [person] };
    }

    if (lowerSql.includes("update academy_people set") && lowerSql.includes("display_name")) {
      const personId = String(params[1]);
      const person = this.people.get(personId);
      if (!person || person.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }

      // Extract updated values from params - simplified for test
      // Params order: tenant_id, person_id, then SET values
      const updated = {
        ...person,
        display_name: params[2] ?? person.display_name,
        email: params.length > 3 ? params[3] : person.email,
        updated_at: new Date()
      };
      this.people.set(personId, updated);
      return { rowCount: 1, rows: [updated] };
    }

    if (lowerSql.includes("select id, person_status from academy_people")) {
      const person = this.people.get(String(params[1]));
      if (!person || person.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [{ id: person.id, person_status: person.person_status }] };
    }

    if (lowerSql.includes("select id from academy_student_profiles") && lowerSql.includes("enrollment_status")) {
      const active = Array.from(this.studentProfiles.values()).filter(
        (sp) => sp.tenant_id === params[0] && sp.person_id === params[1] && 
        (sp.enrollment_status === "active" || sp.enrollment_status === "admitted")
      );
      return { rowCount: active.length, rows: active };
    }

    if (lowerSql.includes("select id from academy_staff_profiles") && lowerSql.includes("employment_status")) {
      const active = Array.from(this.staffProfiles.values()).filter(
        (sp) => sp.tenant_id === params[0] && sp.person_id === params[1] && sp.employment_status === "active"
      );
      return { rowCount: active.length, rows: active };
    }

    if (lowerSql.includes("update academy_people set person_status")) {
      const personId = String(params[1]);
      const person = this.people.get(personId);
      if (!person || person.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }

      const updated = { ...person, person_status: "archived", updated_at: new Date() };
      this.people.set(personId, updated);
      return { rowCount: 1, rows: [updated] };
    }

    if (lowerSql.includes("insert into academy_audit_events")) {
      this.auditEvents.push({ tenant_id: params[0], actor_person_id: params[1], action: params[2] });
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }

  getAuditEvents() {
    return this.auditEvents;
  }
}

describe("Person Mutations", () => {
  const tenantId = "tenant-123";
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId,
    roles: ["institution_admin"],
  };

  test("createPerson: success", async () => {
    const db = new MockDatabase();
    const input: CreatePersonInput = {
      displayName: "John Doe",
      givenName: "John",
      familyName: "Doe",
      email: "john.doe@test.com",
    };

    const result = await createPerson(actor, input, db);

    assert.strictEqual(result.displayName, "John Doe");
    assert.strictEqual(result.givenName, "John");
    assert.strictEqual(result.tenantId, tenantId);
    assert.strictEqual(result.personStatus, "active");
    assert.doesNotMatch(JSON.stringify(result), /credentialSecret|accessToken|refreshToken|password/);
  });

  test("createPerson: empty displayName rejected", async () => {
    const db = new MockDatabase();
    const input: CreatePersonInput = {
      displayName: "",
    };

    await assert.rejects(
      async () => createPerson(actor, input, db),
      /Display name is required/
    );
  });

  test("createPerson: duplicate email rejected", async () => {
    const db = new MockDatabase();
    const input: CreatePersonInput = {
      displayName: "Jane Doe",
      email: "duplicate@test.com",
    };

    await createPerson(actor, input, db);

    await assert.rejects(
      async () => createPerson(actor, { displayName: "Another Person", email: "duplicate@test.com" }, db),
      /already exists/
    );
  });

  test("updatePersonFields: cross-tenant rejection", async () => {
    const db = new MockDatabase();
    const person = await createPerson(actor, { displayName: "Test" }, db);

    const wrongActor: AcademyActor = {
      userId: "admin-1",
      tenantId: "wrong-tenant",
      roles: ["institution_admin"],
    };

    await assert.rejects(
      async () => updatePersonFields(wrongActor, person.id, { displayName: "Updated" }, db),
      /Cross-tenant/
    );
  });

  test("updatePersonFields: success", async () => {
    const db = new MockDatabase();
    const input: CreatePersonInput = {
      displayName: "Original Name",
      email: "original@test.com",
    };

    const person = await createPerson(actor, input, db);

    const updateInput: UpdatePersonInput = {
      displayName: "Updated Name",
      email: "updated@test.com",
    };

    const updated = await updatePersonFields(actor, person.id, updateInput, db);

    assert.strictEqual(updated.displayName, "Updated Name");
    assert.doesNotMatch(JSON.stringify(updated), /credentialSecret|accessToken|refreshToken|password/);
  });

  test("archivePerson: success", async () => {
    const db = new MockDatabase();
    const person = await createPerson(actor, { displayName: "Archive Me" }, db);

    await archivePerson(actor, person.id, "No longer needed", db);

    const events = db.getAuditEvents();
    const archiveEvent = events.find(e => e.action === "archive_person");
    assert.ok(archiveEvent);
  });

  test("archivePerson: missing reason rejected", async () => {
    const db = new MockDatabase();
    const person = await createPerson(actor, { displayName: "Test" }, db);

    await assert.rejects(
      async () => archivePerson(actor, person.id, "", db),
      /Reason for archive is required/
    );
  });

  test("archivePerson: cross-tenant rejection", async () => {
    const db = new MockDatabase();
    const person = await createPerson(actor, { displayName: "Test" }, db);

    const wrongActor: AcademyActor = {
      userId: "admin-1",
      tenantId: "wrong-tenant",
      roles: ["institution_admin"],
    };

    await assert.rejects(
      async () => archivePerson(wrongActor, person.id, "reason", db),
      /Cross-tenant/
    );
  });
});
