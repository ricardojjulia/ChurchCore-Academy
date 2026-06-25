import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { CommunicationsService } from "@/modules/communications/service";
import type { CommunicationTemplateKey, CommunicationChannel } from "@/modules/communications/types";

export type InquiryStatus = "new" | "contacted" | "nurturing" | "applied" | "enrolled" | "lost";

export type InquirySource =
  | "website"
  | "referral"
  | "event"
  | "social_media"
  | "partner_church"
  | "other";

export type ConversionEventType =
  | "inquiry_received"
  | "application_started"
  | "application_submitted"
  | "admitted"
  | "enrolled"
  | "declined"
  | "lost";

export type DripTriggerEvent =
  | "inquiry_received"
  | "application_started"
  | "application_submitted";

export interface Inquiry {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  programOfInterest?: string;
  source?: InquirySource;
  inquiryDate: string;
  status: InquiryStatus;
  assignedToPersonId?: string;
  notes?: string;
  convertedToApplicationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInquiryInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  programOfInterest?: string;
  source?: InquirySource;
}

export interface ListInquiriesFilters {
  status?: InquiryStatus;
  assignedToPersonId?: string;
}

export interface DripSequence {
  id: string;
  tenantId: string;
  name: string;
  triggerEvent: DripTriggerEvent;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DripStep {
  id: string;
  tenantId: string;
  sequenceId: string;
  stepNumber: number;
  delayDays: number;
  templateKey: CommunicationTemplateKey;
  channel: CommunicationChannel;
  createdAt: string;
}

export interface CreateDripSequenceInput {
  name: string;
  triggerEvent: DripTriggerEvent;
  steps: Array<{
    stepNumber: number;
    delayDays: number;
    templateKey: CommunicationTemplateKey;
    channel: CommunicationChannel;
  }>;
}

export interface ConversionEvent {
  id: string;
  tenantId: string;
  inquiryId?: string;
  applicationId?: string;
  eventType: ConversionEventType;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface ConversionFunnel {
  inquiriesCount: number;
  appliedCount: number;
  admittedCount: number;
  enrolledCount: number;
  inquiryToApplicationRate: number;
  applicationToAdmissionRate: number;
  admissionToEnrollmentRate: number;
  overallConversionRate: number;
}

export interface ApplicantCrmDatabase {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

function assertAdmissionsStaff(actor: AcademyActor, tenantId: string) {
  if (actor.tenantId !== tenantId) {
    throw new AcademyAuthorizationError("Cross-tenant access forbidden.");
  }

  const staffRoles = ["institution_admin", "admissions"];
  if (!actor.roles.some(role => staffRoles.includes(role))) {
    throw new AcademyAuthorizationError("Forbidden: admissions staff role required.");
  }
}

function assertInstitutionAdmin(actor: AcademyActor, tenantId: string) {
  if (actor.tenantId !== tenantId) {
    throw new AcademyAuthorizationError("Cross-tenant access forbidden.");
  }

  if (!actor.roles.includes("institution_admin")) {
    throw new AcademyAuthorizationError("Forbidden: institution_admin role required.");
  }
}

function mapInquiry(row: Record<string, unknown>): Inquiry {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    email: String(row.email),
    phone: row.phone ? String(row.phone) : undefined,
    programOfInterest: row.program_of_interest ? String(row.program_of_interest) : undefined,
    source: row.source ? (String(row.source) as InquirySource) : undefined,
    inquiryDate: row.inquiry_date instanceof Date
      ? row.inquiry_date.toISOString().split("T")[0]
      : String(row.inquiry_date),
    status: String(row.status) as InquiryStatus,
    assignedToPersonId: row.assigned_to_person_id ? String(row.assigned_to_person_id) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    convertedToApplicationId: row.converted_to_application_id ? String(row.converted_to_application_id) : undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function mapDripSequence(row: Record<string, unknown>): DripSequence {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    triggerEvent: String(row.trigger_event) as DripTriggerEvent,
    active: Boolean(row.active),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function mapDripStep(row: Record<string, unknown>): DripStep {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    sequenceId: String(row.sequence_id),
    stepNumber: Number(row.step_number),
    delayDays: Number(row.delay_days),
    templateKey: String(row.template_key) as CommunicationTemplateKey,
    channel: String(row.channel) as CommunicationChannel,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function createInquiry(
  actor: AcademyActor,
  input: CreateInquiryInput,
  database: ApplicantCrmDatabase,
): Promise<Inquiry> {
  // Allow unauthenticated access; tenant is already enforced by RLS context
  const result = await database.query(
    `insert into academy_inquiries (
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      program_of_interest,
      source,
      status
    ) values ($1, $2, $3, $4, $5, $6, $7, 'new')
    returning *`,
    [
      actor.tenantId,
      input.firstName,
      input.lastName,
      input.email,
      input.phone ?? null,
      input.programOfInterest ?? null,
      input.source ?? null,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Failed to create inquiry.");
  }

  const inquiry = mapInquiry(result.rows[0]);

  // Record conversion event
  await database.query(
    `insert into academy_conversion_events (
      tenant_id,
      inquiry_id,
      event_type,
      metadata
    ) values ($1, $2, 'inquiry_received', '{}'::jsonb)`,
    [inquiry.tenantId, inquiry.id],
  );

  return inquiry;
}

export async function listInquiries(
  actor: AcademyActor,
  filters: ListInquiriesFilters,
  database: ApplicantCrmDatabase,
): Promise<Inquiry[]> {
  assertAdmissionsStaff(actor, actor.tenantId);

  const conditions: string[] = ["tenant_id = $1"];
  const values: unknown[] = [actor.tenantId];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filters.assignedToPersonId) {
    values.push(filters.assignedToPersonId);
    conditions.push(`assigned_to_person_id = $${values.length}`);
  }

  const result = await database.query(
    `select * from academy_inquiries
     where ${conditions.join(" and ")}
     order by inquiry_date desc, created_at desc`,
    values,
  );

  return result.rows.map(mapInquiry);
}

export async function updateInquiryStatus(
  actor: AcademyActor,
  inquiryId: string,
  status: InquiryStatus,
  database: ApplicantCrmDatabase,
): Promise<Inquiry> {
  assertAdmissionsStaff(actor, actor.tenantId);

  const result = await database.query(
    `update academy_inquiries
     set status = $1, updated_at = now()
     where tenant_id = $2 and id = $3
     returning *`,
    [status, actor.tenantId, inquiryId],
  );

  if (!result.rows[0]) {
    throw new Error(`Inquiry ${inquiryId} not found or access denied.`);
  }

  return mapInquiry(result.rows[0]);
}

export async function convertInquiryToApplication(
  actor: AcademyActor,
  inquiryId: string,
  applicationId: string,
  database: ApplicantCrmDatabase,
): Promise<Inquiry> {
  assertAdmissionsStaff(actor, actor.tenantId);

  const result = await database.query(
    `update academy_inquiries
     set status = 'applied',
         converted_to_application_id = $1,
         updated_at = now()
     where tenant_id = $2 and id = $3
     returning *`,
    [applicationId, actor.tenantId, inquiryId],
  );

  if (!result.rows[0]) {
    throw new Error(`Inquiry ${inquiryId} not found or access denied.`);
  }

  const inquiry = mapInquiry(result.rows[0]);

  // Record conversion event
  await database.query(
    `insert into academy_conversion_events (
      tenant_id,
      inquiry_id,
      application_id,
      event_type,
      metadata
    ) values ($1, $2, $3, 'application_started', '{}'::jsonb)`,
    [inquiry.tenantId, inquiry.id, applicationId],
  );

  return inquiry;
}

export async function createDripSequence(
  actor: AcademyActor,
  input: CreateDripSequenceInput,
  database: ApplicantCrmDatabase,
): Promise<{ sequence: DripSequence; steps: DripStep[] }> {
  assertInstitutionAdmin(actor, actor.tenantId);

  // Create sequence
  const sequenceResult = await database.query(
    `insert into academy_drip_sequences (
      tenant_id,
      name,
      trigger_event,
      active
    ) values ($1, $2, $3, true)
    returning *`,
    [actor.tenantId, input.name, input.triggerEvent],
  );

  if (!sequenceResult.rows[0]) {
    throw new Error("Failed to create drip sequence.");
  }

  const sequence = mapDripSequence(sequenceResult.rows[0]);

  // Create steps
  const steps: DripStep[] = [];
  for (const step of input.steps) {
    const stepResult = await database.query(
      `insert into academy_drip_steps (
        tenant_id,
        sequence_id,
        step_number,
        delay_days,
        template_key,
        channel
      ) values ($1, $2, $3, $4, $5, $6)
      returning *`,
      [
        actor.tenantId,
        sequence.id,
        step.stepNumber,
        step.delayDays,
        step.templateKey,
        step.channel,
      ],
    );

    if (stepResult.rows[0]) {
      steps.push(mapDripStep(stepResult.rows[0]));
    }
  }

  return { sequence, steps };
}

export async function triggerDripSequence(
  actor: AcademyActor,
  inquiryId: string,
  triggerEvent: DripTriggerEvent,
  database: ApplicantCrmDatabase,
  communicationsService: Pick<CommunicationsService, "createCommunication">,
): Promise<{ messagesScheduled: number }> {
  assertAdmissionsStaff(actor, actor.tenantId);

  // Verify inquiry exists in tenant
  const inquiryResult = await database.query(
    `select * from academy_inquiries where tenant_id = $1 and id = $2`,
    [actor.tenantId, inquiryId],
  );

  if (!inquiryResult.rows[0]) {
    throw new Error(`Inquiry ${inquiryId} not found or access denied.`);
  }

  const inquiry = mapInquiry(inquiryResult.rows[0]);

  // Find active sequences for this trigger event
  const sequencesResult = await database.query(
    `select * from academy_drip_sequences
     where tenant_id = $1 and trigger_event = $2 and active = true`,
    [actor.tenantId, triggerEvent],
  );

  let messagesScheduled = 0;

  for (const sequenceRow of sequencesResult.rows) {
    const sequence = mapDripSequence(sequenceRow);

    // Get steps for this sequence
    const stepsResult = await database.query(
      `select * from academy_drip_steps
       where tenant_id = $1 and sequence_id = $2
       order by step_number asc`,
      [actor.tenantId, sequence.id],
    );

    for (const stepRow of stepsResult.rows) {
      const step = mapDripStep(stepRow);

      try {
        const systemActor: AcademyActor = {
          tenantId: actor.tenantId,
          userId: "system",
          roles: ["institution_admin"],
        };

        const sendAt = new Date();
        sendAt.setDate(sendAt.getDate() + step.delayDays);

        const idempotencyKey = `drip:${inquiryId}:${sequence.id}:${step.stepNumber}`;

        await communicationsService.createCommunication(systemActor, {
          templateKey: step.templateKey,
          audience: { type: "staff_role", roles: ["admissions"] },
          channels: [step.channel],
          variables: {
            firstName: inquiry.firstName,
            lastName: inquiry.lastName,
            email: inquiry.email,
            programOfInterest: inquiry.programOfInterest ?? "",
            inquiryId: inquiry.id,
          },
          sourceType: "admissions",
          sourceId: inquiryId,
          idempotencyKey,
          essential: false,
          sendAt: sendAt.toISOString(),
        });

        messagesScheduled += 1;
      } catch (error) {
        console.error(
          `Failed to schedule drip step ${step.stepNumber} for sequence ${sequence.id}:`,
          error,
        );
        // Continue with other steps even if one fails
      }
    }
  }

  return { messagesScheduled };
}

export async function getConversionFunnel(
  actor: AcademyActor,
  database: ApplicantCrmDatabase,
): Promise<ConversionFunnel> {
  assertAdmissionsStaff(actor, actor.tenantId);

  const result = await database.query(
    `select
       count(*) filter (where event_type = 'inquiry_received') as inquiries_count,
       count(*) filter (where event_type = 'application_started') as applied_count,
       count(*) filter (where event_type = 'admitted') as admitted_count,
       count(*) filter (where event_type = 'enrolled') as enrolled_count
     from academy_conversion_events
     where tenant_id = $1`,
    [actor.tenantId],
  );

  const row = result.rows[0];
  if (!row) {
    return {
      inquiriesCount: 0,
      appliedCount: 0,
      admittedCount: 0,
      enrolledCount: 0,
      inquiryToApplicationRate: 0,
      applicationToAdmissionRate: 0,
      admissionToEnrollmentRate: 0,
      overallConversionRate: 0,
    };
  }

  const inquiriesCount = Number(row.inquiries_count) || 0;
  const appliedCount = Number(row.applied_count) || 0;
  const admittedCount = Number(row.admitted_count) || 0;
  const enrolledCount = Number(row.enrolled_count) || 0;

  const inquiryToApplicationRate = inquiriesCount > 0
    ? (appliedCount / inquiriesCount) * 100
    : 0;
  const applicationToAdmissionRate = appliedCount > 0
    ? (admittedCount / appliedCount) * 100
    : 0;
  const admissionToEnrollmentRate = admittedCount > 0
    ? (enrolledCount / admittedCount) * 100
    : 0;
  const overallConversionRate = inquiriesCount > 0
    ? (enrolledCount / inquiriesCount) * 100
    : 0;

  return {
    inquiriesCount,
    appliedCount,
    admittedCount,
    enrolledCount,
    inquiryToApplicationRate: Math.round(inquiryToApplicationRate * 100) / 100,
    applicationToAdmissionRate: Math.round(applicationToAdmissionRate * 100) / 100,
    admissionToEnrollmentRate: Math.round(admissionToEnrollmentRate * 100) / 100,
    overallConversionRate: Math.round(overallConversionRate * 100) / 100,
  };
}
