import assert from "node:assert/strict";
import test from "node:test";
import { listCourseRegistrations } from "@/app/api/academy/registrations/route";
import { readDeleteRegistrationBody } from "@/app/api/academy/registrations/[id]/route";
import type { AcademyActor } from "@/modules/academy-auth/policy";

const student: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const registrar: AcademyActor = {
  userId: "person-registrar",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

test("student registration list is scoped to the verified student actor", async () => {
  const queries: unknown[][] = [];
  const response = await listCourseRegistrations(
    new Request("http://localhost/api/academy/registrations"),
    {
      resolveActor: async () => student,
      query: async (_sql, values) => {
        queries.push(values ?? []);
        return {
          rows: [
            {
              id: "registration-1",
              course_section_id: "section-1",
              student_person_id: "person-student",
              student_profile_id: "student-profile-1",
              program_enrollment_id: "program-enrollment-1",
              period_registration_id: "period-registration-1",
              status: "registered",
              registered_at: "2026-06-21T04:00:00.000Z",
              confirmed_at: "2026-06-21T04:00:00.000Z",
              idempotency_key: "idem-1",
              source_application_id: "application-1",
            },
          ],
        };
      },
    },
  );
  const body = await response.json() as Array<{ studentPersonId: string }>;

  assert.equal(response.status, 200);
  assert.equal(body[0]?.studentPersonId, "person-student");
  assert.deepEqual(queries, [["tenant-1", "person-student"]]);
});

test("registrar registration list may read the tenant roster", async () => {
  const queries: unknown[][] = [];
  const response = await listCourseRegistrations(
    new Request("http://localhost/api/academy/registrations"),
    {
      resolveActor: async () => registrar,
      query: async (_sql, values) => {
        queries.push(values ?? []);
        return {
          rows: [
            {
              id: "registration-1",
              course_section_id: "section-1",
              student_person_id: "person-student",
              student_profile_id: "student-profile-1",
              program_enrollment_id: "program-enrollment-1",
              period_registration_id: "period-registration-1",
              status: "registered",
              registered_at: "2026-06-21T04:00:00.000Z",
              confirmed_at: "2026-06-21T04:00:00.000Z",
              idempotency_key: "idem-1",
              source_application_id: "application-1",
            },
          ],
        };
      },
    },
  );
  const body = await response.json() as Array<{ studentPersonId: string }>;

  assert.equal(response.status, 200);
  assert.equal(body[0]?.studentPersonId, "person-student");
  assert.deepEqual(queries, [["tenant-1"]]);
});

test("delete registration body accepts an optional override reason", async () => {
  const body = await readDeleteRegistrationBody(
    new Request("http://localhost/api/academy/registrations/registration-1", {
      method: "DELETE",
      body: JSON.stringify({ overrideReason: "Registrar-approved late drop." }),
    }),
  );

  assert.deepEqual(body, { overrideReason: "Registrar-approved late drop." });
});

test("delete registration body accepts an empty body", async () => {
  const body = await readDeleteRegistrationBody(
    new Request("http://localhost/api/academy/registrations/registration-1", {
      method: "DELETE",
    }),
  );

  assert.deepEqual(body, {});
});

test("delete registration body rejects malformed JSON safely", async () => {
  await assert.rejects(
    async () => {
      await readDeleteRegistrationBody(
        new Request("http://localhost/api/academy/registrations/registration-1", {
          method: "DELETE",
          body: "{",
        }),
      );
    },
    { message: "Malformed JSON body." },
  );
});
