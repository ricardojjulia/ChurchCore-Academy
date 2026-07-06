import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createStaffProfile, updateStaffProfile, deactivateStaff, CreateStaffProfileInput, UpdateStaffProfileInput } from "../staff-mutations";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  private people = new Map<string, Record<string, unknown>>();
  private staffProfiles = new Map<string, Record<string, unknown>>();
  private auditEvents: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const lowerSql = sql.toLowerCase();

    if (lowerSql.includes("select id from academy_people where tenant_id")) {
      const person = Array.from(this.people.values()).find(
        (p) => p.tenant_id === params[0] && p.id === params[1]
      );
      return { rowCount: person ? 1 : 0, rows: person ? [person] : [] };
    }

    if (lowerSql.includes("select count(*) as total from academy_staff_profiles")) {
      const count = Array.from(this.staffProfiles.values()).filter(
        (sp) => sp.tenant_id === params[0]
      ).length;
      return { rowCount: 1, rows: [{ total: count }] };
    }

    if (lowerSql.includes("insert into academy_staff_profiles")) {
      const id = String(params[0]);
      const row = {
        id,
        tenant_id: params[1],
        person_id: params[2],
        staff_number: params[3],
        title: params[4],
        primary_role: params[5],
        primary_subdivision_id: params[6],
        employment_status: params[7],
        load_policy: params[8],
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.staffProfiles.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

    if (lowerSql.includes("select id, tenant_id, person_id, staff_number") && lowerSql.includes("from academy_staff_profiles")) {
      const profile = this.staffProfiles.get(String(params[1]));
      if (!profile || profile.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [profile] };
    }

    if (lowerSql.includes("update academy_staff_profiles set") && lowerSql.includes("title")) {
      const profileId = String(params[1]);
      const profile = this.staffProfiles.get(profileId);
      if (!profile || profile.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }

      const updated = { ...profile, updated_at: new Date() };
      this.staffProfiles.set(profileId, updated);
      return { rowCount: 1, rows: [updated] };
    }

    if (lowerSql.includes("select id, employment_status from academy_staff_profiles")) {
      const profile = this.staffProfiles.get(String(params[1]));
      if (!profile || profile.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [{ id: profile.id, employment_status: profile.employment_status }] };
    }

    if (lowerSql.includes("update academy_staff_profiles set employment_status")) {
      const profileId = String(params[1]);
      const profile = this.staffProfiles.get(profileId);
      if (!profile || profile.tenant_id !== params[0]) {
        return { rowCount: 0, rows: [] };
      }

      const updated = { ...profile, employment_status: "archived", updated_at: new Date() };
      this.staffProfiles.set(profileId, updated);
      return { rowCount: 1, rows: [updated] };
    }

    if (lowerSql.includes("insert into academy_audit_events")) {
      this.auditEvents.push({ tenant_id: params[0], actor_person_id: params[1], action: params[2] });
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }

  addPerson(id: string, tenantId: string) {
    this.people.set(id, { id, tenant_id: tenantId, display_name: "Test Person" });
  }
}

describe("Staff Mutations", () => {
  const tenantId = "tenant-123";
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId,
    roles: ["institution_admin"],
  };

  test("createStaffProfile: success", async () => {
    const db = new MockDatabase();
    const personId = "person-123";
    db.addPerson(personId, tenantId);

    const input: CreateStaffProfileInput = {
      personId,
      title: "Professor of Theology",
      primaryRole: "professor",
      employmentStatus: "active",
    };

    const result = await createStaffProfile(actor, input, db);

    assert.strictEqual(result.title, "Professor of Theology");
    assert.strictEqual(result.primaryRole, "professor");
    assert.strictEqual(result.staffNumber, "STF-000001");
    assert.doesNotMatch(JSON.stringify(result), /credentialSecret|accessToken|refreshToken|password/);
  });

  test("createStaffProfile: missing title rejected", async () => {
    const db = new MockDatabase();
    const personId = "person-123";
    db.addPerson(personId, tenantId);

    const input: CreateStaffProfileInput = {
      personId,
      title: "",
      primaryRole: "professor",
      employmentStatus: "active",
    };

    await assert.rejects(
      async () => createStaffProfile(actor, input, db),
      /Staff title is required/
    );
  });

  test("createStaffProfile: cross-tenant rejection", async () => {
    const db = new MockDatabase();
    const personId = "person-123";
    db.addPerson(personId, "other-tenant");

    const input: CreateStaffProfileInput = {
      personId,
      title: "Test",
      primaryRole: "professor",
      employmentStatus: "active",
    };

    await assert.rejects(
      async () => createStaffProfile(actor, input, db),
      /Cross-tenant/
    );
  });

  test("updateStaffProfile: success", async () => {
    const db = new MockDatabase();
    const personId = "person-123";
    db.addPerson(personId, tenantId);

    const input: CreateStaffProfileInput = {
      personId,
      title: "Original Title",
      primaryRole: "professor",
      employmentStatus: "active",
    };

    const profile = await createStaffProfile(actor, input, db);

    const updateInput: UpdateStaffProfileInput = {
      title: "Updated Title",
    };

    const updated = await updateStaffProfile(actor, profile.id, updateInput, db);
    assert.ok(updated);
    assert.doesNotMatch(JSON.stringify(updated), /credentialSecret|accessToken|refreshToken|password/);
  });

  test("deactivateStaff: success", async () => {
    const db = new MockDatabase();
    const personId = "person-123";
    db.addPerson(personId, tenantId);

    const profile = await createStaffProfile(actor, {
      personId,
      title: "Test",
      primaryRole: "professor",
      employmentStatus: "active",
    }, db);

    await deactivateStaff(actor, profile.id, "Retirement", db);
    // Test passes if no error thrown
    assert.ok(true);
  });

  test("deactivateStaff: missing reason rejected", async () => {
    const db = new MockDatabase();
    const personId = "person-123";
    db.addPerson(personId, tenantId);

    const profile = await createStaffProfile(actor, {
      personId,
      title: "Test",
      primaryRole: "professor",
      employmentStatus: "active",
    }, db);

    await assert.rejects(
      async () => deactivateStaff(actor, profile.id, "", db),
      /Reason for deactivation is required/
    );
  });
});
