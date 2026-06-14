import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor, assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { buildLmsContractDescriptorPayload } from "@/app/api/academy/lms/contract/route";
import { buildWorkflowQueuePayload } from "@/app/api/academy/workflows/route";

// ---------------------------------------------------------------------------
// Mock repository — throws on any read to confirm policy fires first
// ---------------------------------------------------------------------------

const throwingRepo = new Proxy({} as never, {
  get() {
    return () => {
      throw new Error("Repository must not be reached before policy check.");
    };
  },
});

const correlationId = "test-correlation";

// ---------------------------------------------------------------------------
// 1. Institution config access policy (via direct policy assertion)
// ---------------------------------------------------------------------------

test("institution config policy rejects actor with no roles", () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: [] };
  assert.throws(
    () => assertInstitutionConfigAccess(actor, "tenant-a", "read"),
    /Forbidden institution configuration access./,
  );
});

test("institution config policy rejects cross-tenant read", () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: ["institution_admin"] };
  assert.throws(
    () => assertInstitutionConfigAccess(actor, "tenant-b", "read"),
    /Forbidden institution configuration access./,
  );
});

test("institution config policy rejects student role read", () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: ["student"] };
  assert.throws(
    () => assertInstitutionConfigAccess(actor, "tenant-a", "read"),
    /Forbidden institution configuration access./,
  );
});

test("institution config policy allows institution_admin same-tenant read", () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: ["institution_admin"] };
  assert.doesNotThrow(() => assertInstitutionConfigAccess(actor, "tenant-a", "read"));
});

test("institution config policy allows registrar same-tenant read", () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: ["registrar"] };
  assert.doesNotThrow(() => assertInstitutionConfigAccess(actor, "tenant-a", "read"));
});

test("institution config policy denies registrar write", () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: ["registrar"] };
  assert.throws(
    () => assertInstitutionConfigAccess(actor, "tenant-a", "write"),
    /Forbidden institution configuration access./,
  );
});

// ---------------------------------------------------------------------------
// 2. LMS contract descriptor — cross-tenant blocked before repository
// ---------------------------------------------------------------------------

test("lms contract descriptor rejects cross-tenant actor", async () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: ["institution_admin"] };
  await assert.rejects(
    () => buildLmsContractDescriptorPayload(throwingRepo, actor, "tenant-b", correlationId),
    (err: Error) => err instanceof AcademyAuthorizationError || /forbidden/i.test(err.message),
  );
});

test("lms contract descriptor allows institution_admin same-tenant (throws at repo, not at policy)", async () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: ["institution_admin"] };
  await assert.rejects(
    () => buildLmsContractDescriptorPayload(throwingRepo, actor, "tenant-a", correlationId),
    /Repository must not be reached before policy check/,
  );
});

// ---------------------------------------------------------------------------
// 3. Workflow queue — role and cross-tenant enforcement via buildWorkflowQueuePayload
// ---------------------------------------------------------------------------

test("workflow queue payload rejects guardian role", async () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: ["guardian"] };
  await assert.rejects(
    () => buildWorkflowQueuePayload(throwingRepo, actor, { status: "all" }),
    (err: Error) => err instanceof AcademyAuthorizationError || /forbidden/i.test(err.message),
  );
});

test("workflow queue payload rejects student role", async () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: ["student"] };
  await assert.rejects(
    () => buildWorkflowQueuePayload(throwingRepo, actor, { status: "all" }),
    (err: Error) => err instanceof AcademyAuthorizationError || /forbidden/i.test(err.message),
  );
});

test("workflow queue payload allows academic_admin (throws at repo, not at policy)", async () => {
  const actor: AcademyActor = { userId: "u1", tenantId: "tenant-a", roles: ["academic_admin"] };
  await assert.rejects(
    () => buildWorkflowQueuePayload(throwingRepo, actor, { status: "all" }),
    /Repository must not be reached before policy check/,
  );
});
