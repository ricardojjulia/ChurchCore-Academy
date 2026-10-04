import { AiTaskKind, AiTaskProfile } from "@/modules/ai-gateway/types";

// Each task kind is an "ask": what the model is being used for. The evaluator scores every
// candidate model against these synthetic cases, then weighs quality against OpenRouter's live
// pricing and observed latency using the profile's weights. Cases are synthetic by rule — no
// tenant, student, or staff data ever appears here.

const ACADEMY_CONTEXT =
  "Project: ChurchCore Academy, a faith-based student information system (SIS) for Bible schools, " +
  "seminaries, children's schools, and colleges. Stack: Next.js App Router, TypeScript, Supabase " +
  "Postgres with row-level security, Vercel. Tenant isolation is enforced in every module.";

export const AI_TASK_PROFILES: Record<AiTaskKind, AiTaskProfile> = {
  hq_council_review: {
    kind: "hq_council_review",
    label: "Council review",
    description: "Multi-section governance review of a proposed feature (HQ Run Council Review).",
    weights: { quality: 0.7, cost: 0.2, latency: 0.1 },
    qualityFloor: 0.7,
    referenceCostUsd: 0.03,
    referenceLatencyMs: 60_000,
    maxRequestCostUsd: 0.25,
    typicalPromptTokens: 2_000,
    typicalCompletionTokens: 3_000,
    minContextTokens: 64_000,
    maxOutputTokens: 8_000,
    evaluationTimeoutMs: 150_000,
    evaluationCases: [
      {
        id: "council-waitlist",
        system: `You are the Product Manager on an architecture council.\n\n${ACADEMY_CONTEXT}`,
        prompt:
          "Run a council review for the proposed feature. Return: 1. Executive summary 2. Recommendation " +
          "3. Architecture impact 4. Data model impact 5. Security/RLS risks 6. QA acceptance criteria " +
          "7. UX concerns 8. Implementation phases 9. Decision record draft\n\n" +
          "Feature: course section waitlists with automatic seat offers when an enrolled student drops.",
        rubric:
          "Covers all nine numbered sections. Identifies tenant isolation and RLS on the waitlist table, " +
          "race conditions when two drops happen at once, offer expiry, and notification of the offered " +
          "student. Acceptance criteria are testable. Phases are ordered sensibly. No invented product facts.",
        requiredTerms: ["waitlist", "tenant", "expir", "acceptance"],
        maxWords: 1_400,
      },
      {
        id: "council-guardian-portal",
        system: `You are the Product Manager on an architecture council.\n\n${ACADEMY_CONTEXT}`,
        prompt:
          "Run a council review for the proposed feature. Return: 1. Executive summary 2. Recommendation " +
          "3. Architecture impact 4. Data model impact 5. Security/RLS risks 6. QA acceptance criteria " +
          "7. UX concerns 8. Implementation phases 9. Decision record draft\n\n" +
          "Feature: guardians of children's-school students can view released report cards in the student PWA.",
        rubric:
          "Covers all nine sections. Restricts guardians to linked students only and to released (not draft " +
          "or held) records. Calls out age/consent rules and cross-tenant leakage risks. Practical phases.",
        requiredTerms: ["guardian", "released", "rls"],
        maxWords: 1_400,
      },
    ],
  },
  hq_reasoning: {
    kind: "hq_reasoning",
    label: "Architecture & product reasoning",
    description: "Architecture, product, security, academic-operations, and analytics advice in HQ.",
    weights: { quality: 0.6, cost: 0.25, latency: 0.15 },
    qualityFloor: 0.7,
    referenceCostUsd: 0.02,
    referenceLatencyMs: 30_000,
    maxRequestCostUsd: 0.15,
    typicalPromptTokens: 3_000,
    typicalCompletionTokens: 1_500,
    minContextTokens: 64_000,
    maxOutputTokens: 6_000,
    evaluationTimeoutMs: 90_000,
    evaluationCases: [
      {
        id: "reasoning-rls-threat-model",
        system: `You are the Security Officer, threat-modeling everything.\n\n${ACADEMY_CONTEXT}`,
        prompt:
          "We are adding an API route that lets a registrar export transcripts for a list of student IDs " +
          "passed in the request body. List the top threats and the concrete mitigations, most severe first.",
        rubric:
          "Leads with IDOR / cross-tenant export (IDs from another tenant), then authorization by role, bulk " +
          "data exfiltration limits, audit logging without logging grade payloads, and rate limiting. " +
          "Mitigations are specific to the route, not generic security advice.",
        requiredTerms: ["tenant", "audit", "authoriz"],
        maxWords: 700,
      },
      {
        id: "reasoning-term-structure",
        system: `You are The Architect, designing for long-term maintainability.\n\n${ACADEMY_CONTEXT}`,
        prompt:
          "A seminary uses quarters, a children's school uses semesters with grading periods, and a Bible " +
          "school runs rolling 8-week modules. Propose a single academic calendar model that supports all " +
          "three without hardcoding college assumptions. Be concise.",
        rubric:
          "Proposes a configurable hierarchy (year > term/session > period) with institution-defined types " +
          "rather than enums of 'semester'. Handles rolling/overlapping modules. Mentions how grading periods " +
          "attach. Concise and internally consistent.",
        requiredTerms: ["period", "configur"],
        maxWords: 600,
      },
    ],
  },
  hq_engineering: {
    kind: "hq_engineering",
    label: "Engineering & implementation",
    description: "SQL, API contracts, TypeScript, tests, and CI/CD output from HQ build agents.",
    weights: { quality: 0.65, cost: 0.2, latency: 0.15 },
    qualityFloor: 0.7,
    referenceCostUsd: 0.02,
    referenceLatencyMs: 40_000,
    maxRequestCostUsd: 0.15,
    typicalPromptTokens: 3_000,
    typicalCompletionTokens: 2_000,
    minContextTokens: 64_000,
    maxOutputTokens: 6_000,
    evaluationTimeoutMs: 90_000,
    evaluationCases: [
      {
        id: "engineering-rls-migration",
        system: `You are The Engineer. Produce concrete SQL and TypeScript. No hand-waving.\n\n${ACADEMY_CONTEXT}`,
        prompt:
          "Write a Postgres migration for an `academy_course_waitlist_entries` table (tenant_id, section_id, " +
          "student_id, position, created_at) with row-level security that only allows access to rows whose " +
          "tenant_id matches `current_setting('app.tenant_id')`. Include indexes and a uniqueness rule so a " +
          "student cannot be on the same waitlist twice.",
        rubric:
          "Valid Postgres SQL. Enables (ideally forces) RLS, policy compares tenant_id to " +
          "current_setting('app.tenant_id', true) for both USING and WITH CHECK. Unique constraint on " +
          "(tenant_id, section_id, student_id). Sensible indexes. No syntax errors.",
        requiredTerms: ["create table", "row level security", "unique", "current_setting"],
        maxWords: 600,
      },
      {
        id: "engineering-node-test",
        system: `You are The Tester. Use node:test and node:assert/strict only.\n\n${ACADEMY_CONTEXT}`,
        prompt:
          "Write node:test tests for this function:\n\n" +
          "export function letterGrade(percent: number): string {\n" +
          "  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new RangeError('percent');\n" +
          "  if (percent >= 90) return 'A'; if (percent >= 80) return 'B'; if (percent >= 70) return 'C';\n" +
          "  if (percent >= 60) return 'D'; return 'F';\n}\n\nCover boundaries and invalid input.",
        rubric:
          "Uses node:test and node:assert/strict (not Jest/Vitest). Tests each boundary (90, 89.99, 80, 70, " +
          "60, 0, 100) and invalid input (negative, >100, NaN, Infinity) via assert.throws with RangeError. " +
          "Code would run as written.",
        requiredTerms: ["node:test", "assert", "RangeError"],
        maxWords: 600,
      },
    ],
  },
  hq_writing: {
    kind: "hq_writing",
    label: "Writing & ideation",
    description: "Docs, ADRs, runbooks, release notes, and ideation from HQ knowledge agents.",
    weights: { quality: 0.5, cost: 0.3, latency: 0.2 },
    qualityFloor: 0.65,
    referenceCostUsd: 0.01,
    referenceLatencyMs: 20_000,
    maxRequestCostUsd: 0.08,
    typicalPromptTokens: 2_500,
    typicalCompletionTokens: 1_200,
    minContextTokens: 32_000,
    maxOutputTokens: 4_000,
    evaluationTimeoutMs: 75_000,
    evaluationCases: [
      {
        id: "writing-release-notes",
        system: `You are the Technical Writer.\n\n${ACADEMY_CONTEXT}`,
        prompt:
          "Write release notes for administrators (not engineers) covering: bulk email to selected students, " +
          "a custom report builder limited to approved fields, and donor campaign tracking. Keep it under 250 words.",
        rubric:
          "Audience-appropriate (no internal jargon or file paths). Each feature explains what admins can now " +
          "do and any limit. Under 250 words. Clear headings or bullets. No invented features.",
        requiredTerms: ["email", "report", "donor"],
        maxWords: 300,
      },
      {
        id: "writing-runbook",
        system: `You are the Technical Writer.\n\n${ACADEMY_CONTEXT}`,
        prompt:
          "Write a short runbook entry: what an on-call engineer does when the nightly OneRoster roster " +
          "delivery cron fails. Include how to confirm the failure, safe retry, and when to escalate.",
        rubric:
          "Actionable numbered steps: confirm via logs/status, check credentials/config, safe idempotent retry, " +
          "escalation criteria, and communicating impact. Does not suggest editing production data by hand.",
        requiredTerms: ["retry", "escalat"],
        maxWords: 450,
      },
    ],
  },
};

/** HQ agent → ask. Unknown agents fall back to general reasoning. */
const HQ_AGENT_TASK_KINDS: Record<string, AiTaskKind> = {
  architect: "hq_reasoning",
  product: "hq_reasoning",
  security: "hq_reasoning",
  administrator: "hq_reasoning",
  custodian: "hq_reasoning",
  tutor: "hq_reasoning",
  data: "hq_reasoning",
  engineer: "hq_engineering",
  implementer: "hq_engineering",
  tester: "hq_engineering",
  devops: "hq_engineering",
  writer: "hq_writing",
  wildcard: "hq_writing",
};

export function resolveHqTaskKind(agentId: string, mode?: string): AiTaskKind {
  if (mode === "council_review") return "hq_council_review";
  return HQ_AGENT_TASK_KINDS[agentId] ?? "hq_reasoning";
}
