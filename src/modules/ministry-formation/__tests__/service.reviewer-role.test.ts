import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  grantMinistryFormationReviewer,
  revokeMinistryFormationReviewer,
} from "@/modules/ministry-formation/service";
import { createMockDb } from "./service.test-helpers";

test("grantMinistryFormationReviewer success for institution_admin", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();
  await grantMinistryFormationReviewer(actor, "faculty-1", db);
  // If no error, test passes (grant succeeded)
  assert.ok(true);
});

test("grantMinistryFormationReviewer forbidden for non-institution_admin", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await grantMinistryFormationReviewer(actor, "advisor-1", db);
    },
    { message: /Forbidden ministry formation reviewer grant access/i },
  );
});

test("grantMinistryFormationReviewer cross-tenant rejection", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await grantMinistryFormationReviewer(actor, "tenant-b-person", db);
    },
    { message: /Target person not found/i },
  );
});

test("revokeMinistryFormationReviewer success for institution_admin", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();
  await revokeMinistryFormationReviewer(actor, "faculty-1", db);
  // If no error, test passes (revoke succeeded)
  assert.ok(true);
});

test("revokeMinistryFormationReviewer forbidden for non-institution_admin", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await revokeMinistryFormationReviewer(actor, "advisor-1", db);
    },
    { message: /Forbidden ministry formation reviewer revoke access/i },
  );
});

test("revokeMinistryFormationReviewer cross-tenant rejection", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await revokeMinistryFormationReviewer(actor, "tenant-b-person", db);
    },
    { message: /Target person not found/i },
  );
});

