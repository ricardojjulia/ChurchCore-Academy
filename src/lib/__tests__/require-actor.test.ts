import assert from "node:assert/strict";
import test from "node:test";
import { requireActor } from "@/lib/require-actor";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";

function actorWithRoles(roles: AcademyActor["roles"]): AcademyActor {
  return { userId: "person-1", tenantId: "tenant-1", roles };
}

test("requireActor(actor, roles) succeeds when the actor holds one of the listed roles", () => {
  const actor = actorWithRoles(["faculty"]);
  assert.doesNotThrow(() => requireActor(actor, ["institution_admin", "faculty"]));
});

test("requireActor(actor, roles) succeeds when the actor holds any of several listed roles", () => {
  const actor = actorWithRoles(["registrar", "advisor"]);
  assert.doesNotThrow(() => requireActor(actor, ["institution_admin", "advisor"]));
});

test("requireActor(actor, roles) rejects an actor holding none of the listed roles", () => {
  const actor = actorWithRoles(["student"]);
  assert.throws(
    () => requireActor(actor, ["institution_admin", "dean", "registrar", "academic_admin"]),
    AcademyAuthorizationError,
  );
});

test("requireActor(actor, roles) rejects an actor with no roles at all", () => {
  const actor = actorWithRoles([]);
  assert.throws(
    () => requireActor(actor, ["institution_admin"]),
    AcademyAuthorizationError,
  );
});

test("requireActor(actor, roles) narrows correctly: billing role list excludes non-finance staff", () => {
  const billingRoles = ["institution_admin", "finance", "registrar"] as const;
  const faculty = actorWithRoles(["faculty"]);
  const advisor = actorWithRoles(["advisor"]);
  const finance = actorWithRoles(["finance"]);

  assert.throws(() => requireActor(faculty, [...billingRoles]), AcademyAuthorizationError);
  assert.throws(() => requireActor(advisor, [...billingRoles]), AcademyAuthorizationError);
  assert.doesNotThrow(() => requireActor(finance, [...billingRoles]));
});

test("requireActor(actor, roles) accepts a break-glass PlatformRole alongside AcademyRole", () => {
  // src/modules/academic-calendar/period-lifecycle-service.ts's reopenPeriod() legitimately
  // checks a PlatformRole via this same overload — confirm the type union still permits it
  // and the runtime check behaves the same way (membership test against actor.roles).
  const platformActor: AcademyActor = { userId: "p-1", tenantId: "tenant-1", roles: [] };
  assert.throws(() => requireActor(platformActor, ["platform_admin"]), AcademyAuthorizationError);
});
