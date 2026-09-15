import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptanceRoles,
  acceptanceSurfaces,
  assertAcceptanceRoleMatrixComplete,
  requiredAcceptanceRoles,
} from "@/modules/acceptance/role-matrix";

test("ADR-0038 acceptance matrix includes every required role", () => {
  assert.doesNotThrow(() => assertAcceptanceRoleMatrixComplete());
  assert.deepEqual(
    acceptanceRoles.map((entry) => entry.role).sort(),
    [...requiredAcceptanceRoles].sort(),
  );
});

test("ADR-0038 acceptance surfaces define access, denial, boundary, and evidence", () => {
  for (const surface of acceptanceSurfaces) {
    assert.ok(surface.route.startsWith("/"), `${surface.route} must be a route path`);
    assert.ok(surface.allowedRoles.length > 0, `${surface.route} must have allowed roles`);
    assert.ok(surface.deniedRoles.length > 0, `${surface.route} must have denied roles`);
    assert.ok(surface.dataBoundary.length > 12, `${surface.route} must describe the data boundary`);
    assert.match(surface.evidenceCommand, /curl|npm test|agent-browser/);
  }
});

test("finance is a distinct acceptance role for billing and aid", () => {
  const finance = acceptanceRoles.find((entry) => entry.role === "finance");
  assert.ok(finance);
  assert.deepEqual(finance.academyRoles, ["finance"]);
  assert.ok(finance.requiredSurfaces.includes("/admin/billing"));
  assert.ok(finance.requiredSurfaces.includes("/admin/financial-aid"));
});

test("student, guardian, faculty, and platform boundaries are explicitly denied from each other", () => {
  const route = (path: string) => acceptanceSurfaces.find((surface) => surface.route === path);

  assert.ok(route("/admin")?.deniedRoles.includes("student"));
  assert.ok(route("/student")?.deniedRoles.includes("guardian"));
  assert.ok(route("/faculty/gradebook")?.deniedRoles.includes("student"));
  assert.ok(route("/platform/control")?.deniedRoles.includes("student"));
  assert.ok(route("/platform/control")?.deniedRoles.includes("admin"));
});
