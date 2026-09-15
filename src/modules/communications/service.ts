import { randomUUID } from "node:crypto";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type {
  CommunicationAudience,
  CommunicationDirectory,
  CommunicationMessage,
  CommunicationRecipient,
  CommunicationTemplateKey,
  CommunicationsRepository,
  CreateCommunicationInput,
  ProviderFailureInput,
  RenderedCommunicationTemplate,
} from "@/modules/communications/types";

interface TemplateDefinition {
  subject: string;
  body: string;
  required: string[];
}

const adminRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
  "academic_admin",
  "dean",
  "admissions",
  "finance",
]);

const templates: Record<CommunicationTemplateKey, TemplateDefinition> = {
  admissions_decision: {
    subject: "Admissions decision for {{programName}}",
    body: "{{studentName}}, your admissions decision for {{programName}} is available. Review details at {{actionUrl}}.",
    required: ["studentName", "programName", "actionUrl"],
  },
  registration_confirmation: {
    subject: "Registration confirmed for {{sectionName}}",
    body: "{{studentName}}, your registration for {{sectionName}} has been confirmed. Review details at {{actionUrl}}.",
    required: ["studentName", "sectionName", "actionUrl"],
  },
  transcript_update: {
    subject: "Transcript request update",
    body: "{{studentName}}, your transcript request status is {{status}}. Review details at {{actionUrl}}.",
    required: ["studentName", "status", "actionUrl"],
  },
  billing_account_update: {
    subject: "Student account update",
    body: "{{studentName}}, your student account has an update: {{summary}}. Review details at {{actionUrl}}.",
    required: ["studentName", "summary", "actionUrl"],
  },
  grade_release: {
    subject: "Grade released for {{sectionName}}",
    body: "{{studentName}}, a grade has been released for {{sectionName}}. Review details at {{actionUrl}}.",
    required: ["studentName", "sectionName", "actionUrl"],
  },
  attendance_concern: {
    subject: "Attendance concern for {{sectionName}}",
    body: "{{studentName}}, your attendance for {{sectionName}} needs attention. Review details at {{actionUrl}}.",
    required: ["studentName", "sectionName", "actionUrl"],
  },
  workflow_assignment: {
    subject: "Workflow assigned: {{workflowTitle}}",
    body: "{{recipientName}}, {{workflowTitle}} has been assigned to you. Review details at {{actionUrl}}.",
    required: ["recipientName", "workflowTitle", "actionUrl"],
  },
  application_received: {
    subject: "Application received for {{programName}}",
    body: "{{applicantName}}, your application for {{programName}} has been received. You can track your status at {{statusUrl}}.",
    required: ["applicantName", "programName", "statusUrl"],
  },
  award_letter_ready: {
    subject: "Your financial aid award letter is ready",
    body: "{{studentName}}, your financial aid award letter for {{academicYear}} is now available. Please log in to review and respond by {{deadline}}.",
    required: ["studentName", "academicYear", "deadline"],
  },
};

function assertAdmin(actor: AcademyActor) {
  if (!actor.roles.some((role) => adminRoles.has(role))) {
    throw new AcademyAuthorizationError("Forbidden communications access.");
  }
}

function assertSafeVariables(variables: Record<string, unknown>) {
  const unsafeKeys = Object.keys(variables).filter((key) =>
    /secret|token|api.?key|raw.?provider|password/i.test(key),
  );
  if (unsafeKeys.length > 0) {
    throw new Error("Provider secret variables are not allowed in communication templates.");
  }
}

export function renderCommunicationTemplate(
  templateKey: CommunicationTemplateKey,
  variables: Record<string, string | number | boolean | null | undefined>,
): RenderedCommunicationTemplate {
  const template = templates[templateKey];
  if (!template) throw new Error("Invalid communication template.");
  assertSafeVariables(variables);

  for (const key of template.required) {
    if (variables[key] == null || String(variables[key]).trim().length === 0) {
      throw new Error(`Template variable ${key} is required.`);
    }
  }

  const render = (value: string) =>
    value.replaceAll(/\{\{([^}]+)\}\}/g, (_match, key: string) =>
      String(variables[key.trim()] ?? ""),
    );

  return {
    subject: render(template.subject),
    body: render(template.body),
  };
}

export function resolveCommunicationAudience(
  directory: CommunicationDirectory,
  audience: CommunicationAudience,
): CommunicationRecipient[] {
  const peopleById = new Map(directory.people.map((person) => [person.id, person]));

  if (audience.type === "student") {
    const person = peopleById.get(audience.personId);
    return person
      ? [{ personId: person.id, displayName: person.displayName, email: person.email }]
      : [];
  }

  if (audience.type === "guardian") {
    return directory.relationships
      .filter(
        (relationship) =>
          relationship.studentPersonId === audience.studentPersonId &&
          relationship.relationshipType === "guardian" &&
          relationship.status === "active" &&
          relationship.visibility !== "billing_excluded",
      )
      .map((relationship) => peopleById.get(relationship.relatedPersonId))
      .filter((person): person is NonNullable<typeof person> => Boolean(person))
      .map((person) => ({
        personId: person.id,
        displayName: person.displayName,
        email: person.email,
        relatedStudentPersonId: audience.studentPersonId,
      }));
  }

  const allowedRoles = new Set(audience.roles);
  return directory.people
    .filter((person) => person.roles.some((role) => allowedRoles.has(role)))
    .map((person) => ({
      personId: person.id,
      displayName: person.displayName,
      email: person.email,
    }));
}

export class CommunicationsService {
  constructor(private readonly repository: CommunicationsRepository) {}

  async createCommunication(
    actor: AcademyActor,
    input: CreateCommunicationInput,
  ): Promise<CommunicationMessage[]> {
    assertAdmin(actor);
    const existing = await this.repository.findByIdempotencyKey(
      actor.tenantId,
      input.idempotencyKey,
    );
    if (existing.length > 0) return existing;

    const rendered = renderCommunicationTemplate(input.templateKey, input.variables);
    const directory = await this.repository.loadDirectory(actor.tenantId);
    const recipients = resolveCommunicationAudience(directory, input.audience);
    const emailOptOuts = new Set(directory.emailOptOutPersonIds);
    const createdAt = new Date().toISOString();

    const messages: CommunicationMessage[] = [];
    for (const recipient of recipients) {
      for (const channel of input.channels) {
        if (channel === "email" && !input.essential && emailOptOuts.has(recipient.personId)) {
          continue;
        }
        messages.push({
          id: randomUUID(),
          tenantId: actor.tenantId,
          recipientPersonId: recipient.personId,
          recipientDisplayName: recipient.displayName,
          recipientEmail: recipient.email,
          relatedStudentPersonId: recipient.relatedStudentPersonId,
          channel,
          templateKey: input.templateKey,
          subject: rendered.subject,
          body: rendered.body,
          status: "queued",
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          idempotencyKey: input.idempotencyKey,
          retryCount: 0,
          sendAt: input.sendAt,
          createdAt,
        });
      }
    }

    return this.repository.enqueueMessages(
      messages,
      messages.map(() => "queued"),
    );
  }

  async listTenantMessages(actor: AcademyActor) {
    assertAdmin(actor);
    return this.repository.listMessages(actor.tenantId);
  }

  async listMyMessages(actor: AcademyActor) {
    return this.repository.listMessages(actor.tenantId, actor.userId);
  }

  async markRead(actor: AcademyActor, messageId: string) {
    return this.repository.markRead(actor.tenantId, messageId, actor.userId);
  }

  async recordProviderFailure(actor: AcademyActor, input: ProviderFailureInput) {
    assertAdmin(actor);
    return this.repository.markProviderFailure(
      actor.tenantId,
      input.messageId,
      input.reason,
    );
  }
}
