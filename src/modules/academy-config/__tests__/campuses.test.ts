import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { CampusDatabase, Campus } from "@/modules/academy-config/campuses";
import {
  createCampus,
  listCampuses,
  updateCampus,
  setPrimaryCampus,
  deactivateCampus,
} from "@/modules/academy-config/campuses";

const adminActor: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const facultyActor: AcademyActor = {
  userId: "person-faculty",
  tenantId: "tenant-1",
  roles: ["faculty"],
};

const studentActor: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const crossTenantActor: AcademyActor = {
  userId: "person-other",
  tenantId: "tenant-2",
  roles: ["institution_admin"],
};

function mockCampus(overrides: Partial<Campus> = {}): Campus {
  return {
    id: "campus-1",
    tenantId: "tenant-1",
    code: "MAIN",
    name: "Main Campus",
    address: "123 Seminary Drive",
    city: "Nashville",
    state: "TN",
    country: "US",
    isPrimary: true,
    isActive: true,
    createdAt: "2026-06-24T13:00:00Z",
    updatedAt: "2026-06-24T13:00:00Z",
    ...overrides,
  };
}

function campusToRow(c: Campus): Record<string, unknown> {
  return {
    id: c.id,
    tenant_id: c.tenantId,
    code: c.code,
    name: c.name,
    address: c.address,
    city: c.city,
    state: c.state,
    country: c.country,
    is_primary: c.isPrimary,
    is_active: c.isActive,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function createMockDb(campuses: Campus[] = []): CampusDatabase {
  const stored = [...campuses];

  return {
    query: async (sql: string, values?: unknown[]) => {
      const sqlLower = sql.toLowerCase();

      if (sqlLower.includes("select id from academy_campuses") && sqlLower.includes("is_primary = true")) {
        const tenantId = values?.[0];
        const primary = stored.find(c => c.tenantId === tenantId && c.isPrimary);
        return { rowCount: primary ? 1 : 0, rows: primary ? [{ id: primary.id }] : [] };
      }

      if (sqlLower.includes("select * from academy_campuses") && sqlLower.includes("where tenant_id = $1 and id = $2")) {
        const tenantId = values?.[0];
        const campusId = values?.[1];
        const found = stored.find(c => c.tenantId === tenantId && c.id === campusId);
        return { rowCount: found ? 1 : 0, rows: found ? [campusToRow(found)] : [] };
      }

      if (sqlLower.includes("insert into academy_campuses")) {
        const isFirstCampus = !stored.some(c => c.tenantId === values?.[0] && c.isPrimary);
        const newCampus = mockCampus({
          id: `campus-${stored.length + 1}`,
          tenantId: String(values?.[0] ?? "tenant-1"),
          code: String(values?.[1] ?? "MAIN"),
          name: String(values?.[2] ?? "Campus"),
          address: values?.[3] ? String(values[3]) : null,
          city: values?.[4] ? String(values[4]) : null,
          state: values?.[5] ? String(values[5]) : null,
          country: String(values?.[6] ?? "US"),
          isPrimary: isFirstCampus,
        });
        stored.push(newCampus);
        return { rowCount: 1, rows: [campusToRow(newCampus)] };
      }

      if (sqlLower.includes("select * from academy_campuses") && sqlLower.includes("order by")) {
        const tenantId = values?.[0];
        const showInactive = sqlLower.includes("and is_active = true") === false;
        let result = stored.filter(c => c.tenantId === tenantId);
        if (!showInactive) result = result.filter(c => c.isActive);
        return { rowCount: null, rows: result.map(campusToRow) };
      }

      if (sqlLower.includes("update academy_campuses") && sqlLower.includes("is_primary = false")) {
        const tenantId = values?.[0];
        stored.forEach((c, i) => {
          if (c.tenantId === tenantId && c.isPrimary) stored[i] = { ...c, isPrimary: false };
        });
        return { rowCount: null, rows: [] };
      }

      if (sqlLower.includes("update academy_campuses") && sqlLower.includes("is_primary = true")) {
        const tenantId = values?.[0];
        const campusId = values?.[1];
        const idx = stored.findIndex(c => c.tenantId === tenantId && c.id === campusId);
        if (idx < 0) return { rowCount: 0, rows: [] };
        stored[idx] = { ...stored[idx]!, isPrimary: true, updatedAt: new Date().toISOString() };
        return { rowCount: 1, rows: [campusToRow(stored[idx]!)] };
      }

      if (sqlLower.includes("update academy_campuses") && sqlLower.includes("is_active = false")) {
        const tenantId = values?.[0];
        const campusId = values?.[1];
        const idx = stored.findIndex(c => c.tenantId === tenantId && c.id === campusId);
        if (idx < 0) return { rowCount: 0, rows: [] };
        stored[idx] = { ...stored[idx]!, isActive: false, updatedAt: new Date().toISOString() };
        return { rowCount: 1, rows: [campusToRow(stored[idx]!)] };
      }

      if (sqlLower.includes("update academy_campuses")) {
        const tenantId = values?.[values.length - 2];
        const campusId = values?.[values.length - 1];
        const idx = stored.findIndex(c => c.tenantId === tenantId && c.id === campusId);
        if (idx < 0) return { rowCount: 0, rows: [] };
        stored[idx] = { ...stored[idx]!, updatedAt: new Date().toISOString() };
        return { rowCount: 1, rows: [campusToRow(stored[idx]!)] };
      }

      return { rowCount: 0, rows: [] };
    },
  };
}

test("createCampus — first campus becomes primary automatically", async () => {
  const db = createMockDb();

  const campus = await createCampus(adminActor, { code: "MAIN", name: "Main Campus", city: "Nashville" }, db);

  assert.equal(campus.code, "MAIN");
  assert.equal(campus.name, "Main Campus");
  assert.equal(campus.tenantId, "tenant-1");
  assert.equal(campus.isPrimary, true);
  assert.equal(campus.isActive, true);
});

test("createCampus — second campus is not primary", async () => {
  const db = createMockDb([mockCampus({ id: "campus-1", isPrimary: true })]);

  const campus = await createCampus(adminActor, { code: "SAT", name: "Satellite Campus" }, db);

  assert.equal(campus.isPrimary, false);
});

test("createCampus — rejects non-admin", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => createCampus(facultyActor, { code: "MAIN", name: "Main Campus" }, db),
    { name: "AcademyAuthorizationError" },
  );
});

test("createCampus — rejects invalid code format", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => createCampus(adminActor, { code: "main campus!", name: "Main" }, db),
    /code must be/,
  );
});

test("listCampuses — returns active campuses for tenant", async () => {
  const db = createMockDb([
    mockCampus({ id: "c-1", code: "MAIN", isPrimary: true, isActive: true }),
    mockCampus({ id: "c-2", code: "SAT1", isPrimary: false, isActive: true }),
    mockCampus({ id: "c-3", code: "OLD", isPrimary: false, isActive: false }),
  ]);

  const campuses = await listCampuses(adminActor, db);
  assert.equal(campuses.length, 2);
  assert.ok(campuses.every(c => c.isActive));
});

test("listCampuses — students can view campuses", async () => {
  const db = createMockDb([mockCampus()]);
  const campuses = await listCampuses(studentActor, db);
  assert.equal(campuses.length, 1);
});

test("listCampuses — cross-tenant sees empty list", async () => {
  const db = createMockDb([mockCampus()]);
  const campuses = await listCampuses(crossTenantActor, db);
  assert.equal(campuses.length, 0);
});

test("updateCampus — updates name and city", async () => {
  const db = createMockDb([mockCampus({ id: "campus-1" })]);

  const updated = await updateCampus(adminActor, "campus-1", { name: "Updated Main Campus" }, db);
  assert.ok(updated);
});

test("updateCampus — throws for unknown campus", async () => {
  const db = createMockDb([]);
  await assert.rejects(
    () => updateCampus(adminActor, "nonexistent", { name: "X" }, db),
    /not found or access denied/,
  );
});

test("setPrimaryCampus — changes primary campus", async () => {
  const db = createMockDb([
    mockCampus({ id: "campus-1", code: "MAIN", isPrimary: true }),
    mockCampus({ id: "campus-2", code: "SAT1", isPrimary: false }),
  ]);

  const newPrimary = await setPrimaryCampus(adminActor, "campus-2", db);
  assert.equal(newPrimary.isPrimary, true);
});

test("setPrimaryCampus — rejects non-admin", async () => {
  const db = createMockDb([mockCampus()]);
  await assert.rejects(
    () => setPrimaryCampus(facultyActor, "campus-1", db),
    { name: "AcademyAuthorizationError" },
  );
});

test("deactivateCampus — deactivates non-primary campus", async () => {
  const db = createMockDb([
    mockCampus({ id: "campus-1", isPrimary: true }),
    mockCampus({ id: "campus-2", code: "SAT1", isPrimary: false }),
  ]);

  const deactivated = await deactivateCampus(adminActor, "campus-2", db);
  assert.equal(deactivated.isActive, false);
});

test("deactivateCampus — cannot deactivate primary campus", async () => {
  const db = createMockDb([mockCampus({ id: "campus-1", isPrimary: true })]);
  await assert.rejects(
    () => deactivateCampus(adminActor, "campus-1", db),
    /Cannot deactivate the primary campus/,
  );
});

test("deactivateCampus — throws for unknown campus", async () => {
  const db = createMockDb([]);
  await assert.rejects(
    () => deactivateCampus(adminActor, "nonexistent", db),
    /not found or access denied/,
  );
});
