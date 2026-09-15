import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { CovenantFields } from "@/modules/people/types";
import { getCovenantRecord, upsertCovenantRecord } from "@/modules/people/covenant-mutations";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  private people: Record<string, unknown>[] = [];
  private covenantRecords: Record<string, unknown>[] = [];
  private institutionProfiles: Record<string, unknown>[] = [];
  private studentProfiles: Record<string, unknown>[] = [];
  private auditEvents: Record<string, unknown>[] = [];

  constructor() {
    // Add default institution profile with capability enabled
    this.institutionProfiles.push({
      tenant_id: "tenant1",
      capabilities: JSON.stringify({ covenantRecords: "true" }),
    });

    // Add a person in tenant1
    this.people.push({
      id: "person1",
      tenant_id: "tenant1",
      display_name: "Test Person",
    });

    // Add another person (student) in tenant1
    this.people.push({
      id: "student1",
      tenant_id: "tenant1",
      display_name: "Test Student",
    });

    // Add a person in tenant2
    this.people.push({
      id: "person2",
      tenant_id: "tenant2",
      display_name: "Cross Tenant Person",
    });

    // Add student profile with advisor
    this.studentProfiles.push({
      person_id: "student1",
      tenant_id: "tenant1",
      advisor_person_id: "advisor1",
    });
  }

  setCapability(tenantId: string, enabled: boolean) {
    const profile = this.institutionProfiles.find((p) => p.tenant_id === tenantId);
    if (profile) {
      profile.capabilities = JSON.stringify({ covenantRecords: enabled ? "true" : "false" });
    }
  }

  async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const sqlLower = sql.toLowerCase();

    // Audit event insert
    if (sqlLower.includes("insert into academy_audit_events")) {
      this.auditEvents.push({
        tenant_id: params[0],
        actor_person_id: params[1],
        action: params[2],
        entity_type: params[3],
        entity_id: params[4],
        result_status: params[5],
        redacted_metadata: params[6],
      });
      return { rowCount: 1, rows: [] };
    }

    // Institution profile query
    if (sqlLower.includes("select capabilities")) {
      const profile = this.institutionProfiles.find((p) => p.tenant_id === params[0]);
      if (profile) {
        const capabilities = JSON.parse(String(profile.capabilities));
        return {
          rowCount: 1,
          rows: [{ covenant_enabled: capabilities.covenantRecords }],
        };
      }
      return { rowCount: 0, rows: [] };
    }

    // Person lookup
    if (sqlLower.includes("select id from academy_people")) {
      const person = this.people.find(
        (p) => p.tenant_id === params[0] && p.id === params[1]
      );
      return person ? { rowCount: 1, rows: [person] } : { rowCount: 0, rows: [] };
    }

    // Student profile lookup (advisor check)
    if (sqlLower.includes("select 1 from academy_student_profiles")) {
      const profile = this.studentProfiles.find(
        (p) => p.advisor_person_id === params[0] && p.person_id === params[1] && p.tenant_id === params[2]
      );
      return profile ? { rowCount: 1, rows: [{ "?column?": 1 }] } : { rowCount: 0, rows: [] };
    }

    // Covenant record SELECT
    if (sqlLower.includes("select * from academy_covenant_records") && !sqlLower.includes("insert")) {
      const record = this.covenantRecords.find(
        (r) => r.tenant_id === params[0] && r.person_id === params[1]
      );
      return record ? { rowCount: 1, rows: [record] } : { rowCount: 0, rows: [] };
    }

    // Covenant record INSERT
    if (sqlLower.includes("insert into academy_covenant_records")) {
      const [id, tenantId, personId, covenantFieldsJson] = params;
      const existing = this.covenantRecords.find(
        (r) => r.tenant_id === tenantId && r.person_id === personId
      );

      const record = {
        id: String(id),
        tenant_id: String(tenantId),
        person_id: String(personId),
        covenant_fields: JSON.parse(String(covenantFieldsJson)),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update
        Object.assign(existing, record);
        return { rowCount: 1, rows: [existing] };
      } else {
        // Insert
        this.covenantRecords.push(record);
        return { rowCount: 1, rows: [record] };
      }
    }

    return { rowCount: 0, rows: [] };
  }
}

describe("covenant-mutations", () => {
  it("upsertCovenantRecord succeeds when capability enabled", async () => {
    const db = new MockDatabase();
    const actor: AcademyActor = {
      userId: "admin1",
      tenantId: "tenant1",
      roles: ["institution_admin"],
    };

    const covenantFields: CovenantFields = {
      faithDecisionDate: "2020-01-15",
      baptismDate: "2020-03-20",
      baptismForm: "immersion",
      homeChurch: "First Church",
      covenantStatus: "active",
    };

    const result = await upsertCovenantRecord(actor, "person1", covenantFields, db);

    assert.strictEqual(result.personId, "person1");
    assert.strictEqual(result.tenantId, "tenant1");
    assert.strictEqual(result.covenantFields.faithDecisionDate, "2020-01-15");
    assert.strictEqual(result.covenantFields.baptismForm, "immersion");
    assert.strictEqual(result.covenantFields.homeChurch, "First Church");

    // Verify no secret field names in output
    const output = JSON.stringify(result);
    assert.doesNotMatch(output, /credentialSecret|accessToken|refreshToken|password/);
  });

  it("upsertCovenantRecord throws when covenantRecords capability is false", async () => {
    const db = new MockDatabase();
    db.setCapability("tenant1", false);

    const actor: AcademyActor = {
      userId: "admin1",
      tenantId: "tenant1",
      roles: ["institution_admin"],
    };

    const covenantFields: CovenantFields = {
      faithDecisionDate: "2020-01-15",
    };

    await assert.rejects(
      async () => upsertCovenantRecord(actor, "person1", covenantFields, db),
      /Covenant Record feature is not enabled for this institution/
    );
  });

  it("getCovenantRecord strips notes for advisor role", async () => {
    const db = new MockDatabase();
    const admin: AcademyActor = {
      userId: "admin1",
      tenantId: "tenant1",
      roles: ["institution_admin"],
    };

    // First create a record with notes
    const covenantFields: CovenantFields = {
      faithDecisionDate: "2020-01-15",
      notes: "Sensitive pastoral notes",
    };

    await upsertCovenantRecord(admin, "student1", covenantFields, db);

    // Now try to read as advisor
    const advisor: AcademyActor = {
      userId: "advisor1",
      tenantId: "tenant1",
      roles: ["advisor"],
    };

    const result = await getCovenantRecord(advisor, "student1", db);

    assert.ok(result);
    assert.strictEqual(result.personId, "student1");
    assert.strictEqual(result.covenantFields.faithDecisionDate, "2020-01-15");
    assert.strictEqual(result.covenantFields.notes, undefined); // Notes should be stripped

    // Verify no secret field names in output
    const output = JSON.stringify(result);
    assert.doesNotMatch(output, /credentialSecret|accessToken|refreshToken|password/);
  });

  it("getCovenantRecord shows notes for institution_admin role", async () => {
    const db = new MockDatabase();
    const admin: AcademyActor = {
      userId: "admin1",
      tenantId: "tenant1",
      roles: ["institution_admin"],
    };

    // Create a record with notes
    const covenantFields: CovenantFields = {
      faithDecisionDate: "2020-01-15",
      notes: "Sensitive pastoral notes",
    };

    await upsertCovenantRecord(admin, "person1", covenantFields, db);

    // Read as admin
    const result = await getCovenantRecord(admin, "person1", db);

    assert.ok(result);
    assert.strictEqual(result.personId, "person1");
    assert.strictEqual(result.covenantFields.notes, "Sensitive pastoral notes");

    // Verify no secret field names in output
    const output = JSON.stringify(result);
    assert.doesNotMatch(output, /credentialSecret|accessToken|refreshToken|password/);
  });

  it("getCovenantRecord rejects cross-tenant access", async () => {
    const db = new MockDatabase();
    const actor: AcademyActor = {
      userId: "admin1",
      tenantId: "tenant1",
      roles: ["institution_admin"],
    };

    await assert.rejects(
      async () => getCovenantRecord(actor, "person2", db),
      /Cross-tenant access is forbidden/
    );
  });

  it("upsertCovenantRecord rejects cross-tenant access", async () => {
    const db = new MockDatabase();
    const actor: AcademyActor = {
      userId: "admin1",
      tenantId: "tenant1",
      roles: ["institution_admin"],
    };

    const covenantFields: CovenantFields = {
      faithDecisionDate: "2020-01-15",
    };

    await assert.rejects(
      async () => upsertCovenantRecord(actor, "person2", covenantFields, db),
      /Cross-tenant access is forbidden/
    );
  });

  it("getCovenantRecord returns null when record does not exist", async () => {
    const db = new MockDatabase();
    const actor: AcademyActor = {
      userId: "admin1",
      tenantId: "tenant1",
      roles: ["institution_admin"],
    };

    const result = await getCovenantRecord(actor, "person1", db);

    assert.strictEqual(result, null);
  });

  it("upsertCovenantRecord rejects unauthorized role", async () => {
    const db = new MockDatabase();
    const actor: AcademyActor = {
      userId: "student1",
      tenantId: "tenant1",
      roles: ["student"],
    };

    const covenantFields: CovenantFields = {
      faithDecisionDate: "2020-01-15",
    };

    await assert.rejects(
      async () => upsertCovenantRecord(actor, "person1", covenantFields, db),
      /Forbidden: write covenant record requires one of roles/
    );
  });

  it("getCovenantRecord rejects advisor for non-assigned student", async () => {
    const db = new MockDatabase();
    const advisor: AcademyActor = {
      userId: "advisor2",  // Different advisor
      tenantId: "tenant1",
      roles: ["advisor"],
    };

    await assert.rejects(
      async () => getCovenantRecord(advisor, "student1", db),
      /Forbidden: advisors can only access covenant records for assigned students/
    );
  });
});
