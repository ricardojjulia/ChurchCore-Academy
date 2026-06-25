import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { ApplicantCrmDatabase } from "@/modules/admissions/applicant-crm";
import { createDripSequence } from "@/modules/admissions/applicant-crm";
import type { CommunicationTemplateKey, CommunicationChannel } from "@/modules/communications/types";

const VALID_TEMPLATE_KEYS: CommunicationTemplateKey[] = [
  "admissions_decision", "registration_confirmation", "transcript_update",
  "billing_account_update", "grade_release", "attendance_concern",
  "workflow_assignment", "application_received", "award_letter_ready",
];
const VALID_CHANNELS: CommunicationChannel[] = ["in_app", "email"];

function templateKey(value: unknown, index: number): CommunicationTemplateKey {
  const key = String(value ?? "");
  if (!VALID_TEMPLATE_KEYS.includes(key as CommunicationTemplateKey)) {
    throw new Error(`steps[${index}].templateKey "${key}" is not a valid template key.`);
  }
  return key as CommunicationTemplateKey;
}

function channel(value: unknown, index: number): CommunicationChannel {
  const ch = String(value ?? "email");
  if (!VALID_CHANNELS.includes(ch as CommunicationChannel)) {
    throw new Error(`steps[${index}].channel must be "email" or "in_app".`);
  }
  return ch as CommunicationChannel;
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });

    const name = String(body.name ?? "").trim();
    const triggerEvent = String(body.triggerEvent ?? "").trim();
    const steps = body.steps;

    if (!name) {
      throw new Error("name is required.");
    }
    if (!triggerEvent) {
      throw new Error("triggerEvent is required.");
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error("steps array is required and must not be empty.");
    }

    const validTriggers = ["inquiry_received", "application_started", "application_submitted"];
    if (!validTriggers.includes(triggerEvent)) {
      throw new Error(`Invalid triggerEvent. Must be one of: ${validTriggers.join(", ")}`);
    }

    const input = {
      name,
      triggerEvent: triggerEvent as Parameters<typeof createDripSequence>[1]["triggerEvent"],
      steps: steps.map((step: Record<string, unknown>, index: number) => ({
        stepNumber: Number(step.stepNumber ?? index + 1),
        delayDays: Number(step.delayDays ?? 0),
        templateKey: templateKey(step.templateKey, index),
        channel: channel(step.channel, index),
      })),
    };

    const result = await withAcademyDatabaseContext(actor, (client) =>
      createDripSequence(actor, input, asAcademyDatabase<ApplicantCrmDatabase>(client)),
    );

    return result;
  });
}
