import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import type { ApplicantCrmDatabase } from "@/modules/admissions/applicant-crm";
import { createDripSequence, listDripSequences } from "@/modules/admissions/applicant-crm";
import type { CommunicationTemplateKey, CommunicationChannel } from "@/modules/communications/types";

// Restricted to the two templates whose content actually makes sense for a pre-application
// inquiry ("your admissions decision is available" / "your application has been received").
// The other 7 CommunicationTemplateKey values (registration_confirmation, transcript_update,
// billing_account_update, grade_release, attendance_concern, workflow_assignment,
// award_letter_ready) are written for enrolled-student contexts (sectionName, academicYear,
// workflowTitle, etc.) that have no sensible value for someone who is only an inquiry — allowing
// them here would let an admin build a drip step that either always fails
// (renderCommunicationTemplate's required-variable check) or would require faking placeholder
// values to "succeed," producing a nonsensical message. Found live: every template key silently
// failed until this restriction + the variables fix in triggerDripSequence() below.
const VALID_TEMPLATE_KEYS: CommunicationTemplateKey[] = [
  "admissions_decision", "application_received",
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

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    const sequences = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      return listDripSequences(actor, asAcademyDatabase<ApplicantCrmDatabase>(client));
    });

    return { sequences, count: sequences.length };
  });
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

    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      return createDripSequence(actor, input, asAcademyDatabase<ApplicantCrmDatabase>(client));
    });

    return result;
  });
}
