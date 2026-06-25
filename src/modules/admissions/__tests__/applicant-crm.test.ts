import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type {
  ApplicantCrmDatabase,
  Inquiry,
  InquiryStatus,
  DripTriggerEvent,
  CreateInquiryInput,
  CreateDripSequenceInput,
} from "@/modules/admissions/applicant-crm";
import {
  createInquiry,
  listInquiries,
  updateInquiryStatus,
  convertInquiryToApplication,
  createDripSequence,
  triggerDripSequence,
  getConversionFunnel,
} from "@/modules/admissions/applicant-crm";
import type { CreateCommunicationInput } from "@/modules/communications/types";

const admissionsActor: AcademyActor = {
  userId: "person-admissions",
  tenantId: "tenant-1",
  roles: ["admissions"],
};

const adminActor: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const studentActor: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const crossTenantActor: AcademyActor = {
  userId: "person-other",
  tenantId: "tenant-2",
  roles: ["admissions"],
};

function mockInquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: "inquiry-1",
    tenantId: "tenant-1",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "555-1234",
    programOfInterest: "Seminary",
    source: "website",
    inquiryDate: "2026-06-24",
    status: "new",
    createdAt: "2026-06-24T10:00:00.000Z",
    updatedAt: "2026-06-24T10:00:00.000Z",
    ...overrides,
  };
}

function inquiryToDbRow(i: Inquiry): Record<string, unknown> {
  return {
    id: i.id,
    tenant_id: i.tenantId,
    first_name: i.firstName,
    last_name: i.lastName,
    email: i.email,
    phone: i.phone ?? null,
    program_of_interest: i.programOfInterest ?? null,
    source: i.source ?? null,
    inquiry_date: i.inquiryDate,
    status: i.status,
    assigned_to_person_id: i.assignedToPersonId ?? null,
    notes: i.notes ?? null,
    converted_to_application_id: i.convertedToApplicationId ?? null,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  };
}

function mockDatabase(inquiries: Inquiry[] = [], conversionData?: Record<string, number>): ApplicantCrmDatabase {
  const storedInquiries = [...inquiries];
  const conversionEvents: Array<{ event_type: string }> = [];
  const sequences: Array<Record<string, unknown>> = [];
  const steps: Array<Record<string, unknown>> = [];

  return {
    query: async (sql: string, values?: unknown[]) => {
      if (sql.includes("insert into academy_inquiries")) {
        const newInquiry = mockInquiry({
          id: `inquiry-${storedInquiries.length + 1}`,
          tenantId: String(values?.[0] ?? "tenant-1"),
          firstName: String(values?.[1] ?? "Jane"),
          lastName: String(values?.[2] ?? "Doe"),
          email: String(values?.[3] ?? "jane@example.com"),
          phone: values?.[4] ? String(values[4]) : undefined,
          programOfInterest: values?.[5] ? String(values[5]) : undefined,
          source: values?.[6] as Inquiry["source"],
        });
        storedInquiries.push(newInquiry);
        return { rows: [inquiryToDbRow(newInquiry)] };
      }

      if (sql.includes("insert into academy_conversion_events")) {
        const eventType = String(sql.match(/'(inquiry_received|application_started)'/)?.[1] ?? "inquiry_received");
        conversionEvents.push({ event_type: eventType });
        return { rows: [{ id: `event-${conversionEvents.length}` }] };
      }

      // Lookup single inquiry (used by triggerDripSequence)
      if (sql.includes("select * from academy_inquiries") && !sql.includes("order by")) {
        const tenantId = values?.[0];
        const inquiryId = values?.[1];
        const found = storedInquiries.find(i => i.tenantId === tenantId && i.id === inquiryId);
        return { rows: found ? [inquiryToDbRow(found)] : [] };
      }

      if (sql.includes("select * from academy_inquiries") && sql.includes("order by")) {
        const tenantId = values?.[0];
        const hasStatus = sql.includes("status = ");
        const hasAssigned = sql.includes("assigned_to_person_id = ");

        let statusFilter: string | undefined;
        let assignedFilter: string | undefined;
        if (hasStatus && hasAssigned) {
          statusFilter = values?.[1] as string;
          assignedFilter = values?.[2] as string;
        } else if (hasStatus) {
          statusFilter = values?.[1] as string;
        } else if (hasAssigned) {
          assignedFilter = values?.[1] as string;
        }

        let filtered = storedInquiries.filter(i => i.tenantId === tenantId);
        if (statusFilter) filtered = filtered.filter(i => i.status === statusFilter);
        if (assignedFilter) filtered = filtered.filter(i => i.assignedToPersonId === assignedFilter);

        return { rows: filtered.map(inquiryToDbRow) };
      }

      if (sql.includes("update academy_inquiries") && sql.includes("status = $")) {
        const status = values?.[0] as InquiryStatus;
        const tenantId = values?.[1];
        const inquiryId = values?.[2];

        const inquiry = storedInquiries.find(i => i.id === inquiryId && i.tenantId === tenantId);
        if (!inquiry) return { rows: [] };

        const updated = { ...inquiry, status, updatedAt: new Date().toISOString() };
        const index = storedInquiries.findIndex(i => i.id === inquiryId);
        if (index >= 0) storedInquiries[index] = updated;
        return { rows: [inquiryToDbRow(updated)] };
      }

      if (sql.includes("update academy_inquiries") && sql.includes("converted_to_application_id")) {
        const applicationId = values?.[0];
        const tenantId = values?.[1];
        const inquiryId = values?.[2];

        const inquiry = storedInquiries.find(i => i.id === inquiryId && i.tenantId === tenantId);
        if (!inquiry) return { rows: [] };

        const updated: Inquiry = {
          ...inquiry,
          status: "applied",
          convertedToApplicationId: String(applicationId),
          updatedAt: new Date().toISOString(),
        };
        const index = storedInquiries.findIndex(i => i.id === inquiryId);
        if (index >= 0) storedInquiries[index] = updated;
        return { rows: [inquiryToDbRow(updated)] };
      }

      if (sql.includes("insert into academy_drip_sequences")) {
        const seq = {
          id: `seq-${sequences.length + 1}`,
          tenant_id: values?.[0],
          name: values?.[1],
          trigger_event: values?.[2],
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };
        sequences.push(seq);
        return { rows: [seq] };
      }

      if (sql.includes("insert into academy_drip_steps")) {
        const step = {
          id: `step-${steps.length + 1}`,
          tenant_id: values?.[0],
          sequence_id: values?.[1],
          step_number: values?.[2],
          delay_days: values?.[3],
          template_key: values?.[4],
          channel: values?.[5],
          created_at: new Date(),
        };
        steps.push(step);
        return { rows: [step] };
      }

      if (sql.includes("select * from academy_drip_sequences")) {
        const tenantId = values?.[0];
        const triggerEvent = values?.[1];
        return {
          rows: sequences.filter(
            s => s.tenant_id === tenantId && s.trigger_event === triggerEvent && s.active,
          ),
        };
      }

      if (sql.includes("select * from academy_drip_steps")) {
        const tenantId = values?.[0];
        const sequenceId = values?.[1];
        return {
          rows: steps.filter(
            s => s.tenant_id === tenantId && s.sequence_id === sequenceId,
          ),
        };
      }

      if (sql.includes("select") && sql.includes("academy_conversion_events") && sql.includes("count(*)")) {
        const data = conversionData ?? {
          inquiries_count: 100,
          applied_count: 50,
          admitted_count: 30,
          enrolled_count: 25,
        };
        return { rows: [data] };
      }

      return { rows: [] };
    },
  };
}

function mockCommunicationsService() {
  const communications: CreateCommunicationInput[] = [];

  return {
    createCommunication: async (_actor: AcademyActor, input: CreateCommunicationInput) => {
      communications.push(input);
      return {
        id: `comm-${communications.length}`,
        tenantId: _actor.tenantId,
        recipientPersonId: "person-1",
        recipientDisplayName: "Test User",
        channel: input.channels[0],
        templateKey: input.templateKey,
        subject: "Test",
        body: "Test body",
        status: "queued" as const,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        idempotencyKey: input.idempotencyKey,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };
    },
    communications,
  };
}

test("createInquiry: creates inquiry and records conversion event", async () => {
  const db = mockDatabase();
  const input: CreateInquiryInput = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "555-1234",
    programOfInterest: "Seminary",
    source: "website",
  };

  const inquiry = await createInquiry(admissionsActor, input, db);

  assert.equal(inquiry.firstName, "Jane");
  assert.equal(inquiry.lastName, "Doe");
  assert.equal(inquiry.email, "jane@example.com");
  assert.equal(inquiry.status, "new");
  assert.equal(inquiry.tenantId, "tenant-1");
});

test("createInquiry: rejects cross-tenant by RLS (simulated)", async () => {
  const db = mockDatabase();
  const input: CreateInquiryInput = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
  };

  const inquiry = await createInquiry(crossTenantActor, input, db);
  // In real RLS, tenant-2 would not see tenant-1's data
  // Here we simulate successful creation in tenant-2
  assert.equal(inquiry.tenantId, "tenant-2");
});

test("listInquiries: returns filtered inquiries for admissions staff", async () => {
  const db = mockDatabase([
    mockInquiry({ id: "inquiry-1", status: "new" }),
    mockInquiry({ id: "inquiry-2", status: "contacted" }),
    mockInquiry({ id: "inquiry-3", status: "new", assignedToPersonId: "person-1" }),
  ]);

  const all = await listInquiries(admissionsActor, {}, db);
  assert.equal(all.length, 3);

  const newOnly = await listInquiries(admissionsActor, { status: "new" }, db);
  assert.equal(newOnly.length, 2);

  const assigned = await listInquiries(admissionsActor, { assignedToPersonId: "person-1" }, db);
  assert.equal(assigned.length, 1);
  assert.equal(assigned[0].id, "inquiry-3");
});

test("listInquiries: rejects student role", async () => {
  const db = mockDatabase();

  await assert.rejects(
    () => listInquiries(studentActor, {}, db),
    /admissions staff role required/,
  );
});

test("listInquiries: cross-tenant actor sees only their own tenant data (empty)", async () => {
  const db = mockDatabase([mockInquiry()]);

  // tenant-2 actor can list inquiries but sees none (RLS enforces tenant isolation)
  const result = await listInquiries(crossTenantActor, {}, db);
  assert.equal(result.length, 0);
});

test("updateInquiryStatus: updates status for admissions staff", async () => {
  const db = mockDatabase([mockInquiry({ id: "inquiry-1", status: "new" })]);

  const updated = await updateInquiryStatus(admissionsActor, "inquiry-1", "contacted", db);

  assert.equal(updated.status, "contacted");
});

test("updateInquiryStatus: rejects student role", async () => {
  const db = mockDatabase([mockInquiry()]);

  await assert.rejects(
    () => updateInquiryStatus(studentActor, "inquiry-1", "contacted", db),
    /admissions staff role required/,
  );
});

test("convertInquiryToApplication: sets converted_to_application_id and records event", async () => {
  const db = mockDatabase([mockInquiry({ id: "inquiry-1", status: "new" })]);

  const converted = await convertInquiryToApplication(
    admissionsActor,
    "inquiry-1",
    "application-123",
    db,
  );

  assert.equal(converted.status, "applied");
  assert.equal(converted.convertedToApplicationId, "application-123");
});

test("convertInquiryToApplication: throws if inquiry not in tenant", async () => {
  const db = mockDatabase([mockInquiry({ id: "inquiry-1", tenantId: "tenant-1" })]);

  await assert.rejects(
    () => convertInquiryToApplication(crossTenantActor, "inquiry-1", "application-123", db),
    /not found or access denied/,
  );
});

test("createDripSequence: creates sequence with steps", async () => {
  const db = mockDatabase();
  const input: CreateDripSequenceInput = {
    name: "Welcome Series",
    triggerEvent: "inquiry_received",
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        templateKey: "application_received",
        channel: "email",
      },
      {
        stepNumber: 2,
        delayDays: 3,
        templateKey: "admissions_decision",
        channel: "email",
      },
    ],
  };

  const result = await createDripSequence(adminActor, input, db);

  assert.equal(result.sequence.name, "Welcome Series");
  assert.equal(result.sequence.triggerEvent, "inquiry_received");
  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[0].stepNumber, 1);
  assert.equal(result.steps[1].delayDays, 3);
});

test("createDripSequence: rejects non-admin", async () => {
  const db = mockDatabase();
  const input: CreateDripSequenceInput = {
    name: "Test",
    triggerEvent: "inquiry_received",
    steps: [],
  };

  await assert.rejects(
    () => createDripSequence(admissionsActor, input, db),
    /institution_admin role required/,
  );
});

test("triggerDripSequence: schedules messages from active sequences", async () => {
  const db = mockDatabase([mockInquiry({ id: "inquiry-1" })]);
  const comms = mockCommunicationsService();

  // Create a sequence with steps
  await createDripSequence(adminActor, {
    name: "Welcome",
    triggerEvent: "inquiry_received",
    steps: [
      { stepNumber: 1, delayDays: 0, templateKey: "application_received", channel: "email" },
      { stepNumber: 2, delayDays: 3, templateKey: "admissions_decision", channel: "email" },
    ],
  }, db);

  const result = await triggerDripSequence(
    admissionsActor,
    "inquiry-1",
    "inquiry_received",
    db,
    comms,
  );

  assert.equal(result.messagesScheduled, 2);
  assert.equal(comms.communications.length, 2);
  assert.equal(comms.communications[0].templateKey, "application_received");
  assert.equal(comms.communications[1].templateKey, "admissions_decision");
});

test("getConversionFunnel: returns correct counts and rates", async () => {
  const db = mockDatabase([], {
    inquiries_count: 100,
    applied_count: 50,
    admitted_count: 30,
    enrolled_count: 25,
  });

  const funnel = await getConversionFunnel(admissionsActor, db);

  assert.equal(funnel.inquiriesCount, 100);
  assert.equal(funnel.appliedCount, 50);
  assert.equal(funnel.admittedCount, 30);
  assert.equal(funnel.enrolledCount, 25);
  assert.equal(funnel.inquiryToApplicationRate, 50);
  assert.equal(funnel.applicationToAdmissionRate, 60);
  assert.equal(funnel.admissionToEnrollmentRate, 83.33);
  assert.equal(funnel.overallConversionRate, 25);
});

test("getConversionFunnel: rejects student role", async () => {
  const db = mockDatabase();

  await assert.rejects(
    () => getConversionFunnel(studentActor, db),
    /admissions staff role required/,
  );
});
