"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

type ViewId = "dashboard" | "agents" | "docs" | "history" | "tasks" | "decisions" | "risks" | "release";
type HqTaskStatus = "backlog" | "ready" | "in_progress" | "review" | "blocked" | "done";
type HqTaskPriority = "P0" | "P1" | "P2" | "P3";
type HqTaskSource = "manual" | "risk" | "council";
type ChatRole = "user" | "assistant";

interface HqSession {
  id: string;
  user_id: string;
  agent_id: string;
  agent_name: string;
  prompt: string;
  response: string;
  created_at: string;
}

interface HqTask {
  id: string;
  title: string;
  status: HqTaskStatus;
  owner: string | null;
  priority: HqTaskPriority;
  source: HqTaskSource;
  created_at: string;
}

interface HqRisk {
  id: string;
  title: string;
  mitigation: string | null;
  severity: number;
  probability: number;
  owner: string | null;
  created_at: string;
}

interface HqDecision {
  id: string;
  title: string;
  owner: string | null;
  status: "Proposed" | "Accepted" | "Rejected" | "Superseded";
  impact: "Critical" | "High" | "Medium" | "Low";
  created_at: string;
}

interface ChatMessage {
  role: ChatRole;
  content: string;
  ts: string;
  sessionId?: string;
}

interface AgentDef {
  id: string;
  name: string;
  emoji: string;
  role: string;
  layer: string;
  color: string;
  bg: string;
  quick: string[];
  persona: string;
}

const PROJECT_CONTEXT = `Project: ChurchCore Academy / Academy Project HQ
Target Stack: Next.js App Router, TypeScript, Supabase, Postgres RLS, Storage, Realtime, Edge Functions, Vercel.
Core Pattern: AI council + institutional memory + docs + tasks + ADRs + risk register + GitHub-ready governance.
Security Standard: RLS is source of truth. Never trust client-side checks. Every user-visible data path must have policy tests.
Product Goal: Fast, simple, ministry/academic-ready LMS with course creation, modules, assignments, gradebook, certificates, analytics, and AI tutor support.

LLIS Council Mandate (ADR-2025-007):
- Product naming must remain ChurchCore Academy.
- Delivery must be phased: Phase 1 (event + consent + memory foundation), Phase 2 (internal intelligence scoring), Phase 3 (learner-facing mirror/credentials), Phase 4 (social/predictive expansion).
- Consent is mandatory infrastructure: no AI memory, predictive modeling, or social intelligence writes without explicit active consent checks.
- Negative predictive indicators are instructor-only; learner-facing outputs must be growth-oriented and non-alarmist.
- AI-generated narratives are drafts only and must preserve human review checkpoints for interventions and sensitive outcomes.
- Pastoral/ministry-sensitive learner data is high-sensitivity and must use least-privilege access with explicit auditing assumptions.
- Event sourcing is authoritative for behavioral intelligence: append-only activity events, versioned snapshots, and auditable model-versioned computations.`;

const CONSENSUS_PROMPT = `Run a council review for the proposed feature. Return:
1. Executive summary
2. Recommendation
3. Architecture impact
4. Data model impact
5. Security/RLS risks
6. QA acceptance criteria
7. UX concerns
8. Implementation phases
9. Decision record draft

Feature: `;

const AGENTS: Record<string, AgentDef> = {
  architect: {
    id: "architect", name: "The Architect", emoji: "🏛️",
    role: "System Design & Architecture", layer: "Executive",
    color: "#818cf8", bg: "#1e1b4b",
    quick: ["Design the full system topology","Decide multi-tenancy model","Write an ADR for learning objects","Map all integration boundaries"],
    persona: `You are The Architect, a senior technical architect designing a serverless, AI-native LMS on Vercel + Supabase. You think in systems, boundaries, trade-offs, failure modes, and long-term maintainability. Produce ADRs, topology diagrams, domain maps, and migration paths.`
  },
  product: {
    id: "product", name: "Product Manager", emoji: "🧭",
    role: "Roadmap, Scope & Prioritization", layer: "Executive",
    color: "#38bdf8", bg: "#082f49",
    quick: ["Prioritize MVP scope","Create user stories for gradebook","Define release milestones","Write acceptance criteria"],
    persona: `You are the Product Manager. You convert vision into epics, milestones, acceptance criteria, and release sequencing. You protect the MVP from bloat while preserving the larger platform vision.`
  },
  engineer: {
    id: "engineer", name: "The Engineer", emoji: "⚙️",
    role: "Schemas, APIs & Specs", layer: "Build",
    color: "#34d399", bg: "#022c22",
    quick: ["Write core database schema SQL","Design all RLS policies","Spec API routes","Define TypeScript interfaces"],
    persona: `You are The Engineer, a pragmatic senior engineer. Produce concrete SQL, API contracts, TypeScript types, Supabase policies, edge function designs, and implementation checklists. No hand-waving.`
  },
  implementer: {
    id: "implementer", name: "The Implementer", emoji: "💻",
    role: "Code & Deployment", layer: "Build",
    color: "#fbbf24", bg: "#451a03",
    quick: ["Build ModuleItemRenderer","Write auth middleware","Create course page","Implement enrollment function"],
    persona: `You are The Implementer, a full-stack developer writing production-ready Next.js, Supabase, SQL, and Vercel code. Include file paths, strict TypeScript, validation, and error handling.`
  },
  security: {
    id: "security", name: "Security Officer", emoji: "🛡️",
    role: "RLS, Privacy & Threat Models", layer: "Assurance",
    color: "#fb7185", bg: "#4c0519",
    quick: ["Threat model the LMS","Audit RLS policies","Design privacy controls","List OWASP risks"],
    persona: `You are the Security Officer. You threat-model everything: RLS, JWT, IDOR, uploads, storage policies, audit trails, secrets, RBAC, tenant isolation, FERPA/GDPR/COPPA-style privacy, and abuse cases.`
  },
  tester: {
    id: "tester", name: "The Tester", emoji: "🔬",
    role: "QA & Test Strategy", layer: "Assurance",
    color: "#f472b6", bg: "#500724",
    quick: ["Create RLS test suite","Write Playwright flows","Audit enrollment edge cases","Build release checklist"],
    persona: `You are The Tester. You produce unit, integration, e2e, security, accessibility, and performance tests. You think in edge cases, regressions, and release gates.`
  },
  devops: {
    id: "devops", name: "DevOps Officer", emoji: "🚀",
    role: "CI/CD, Environments & Releases", layer: "Operations",
    color: "#22d3ee", bg: "#164e63",
    quick: ["Design GitHub Actions pipeline","Define environments","Create release checklist","Plan rollback strategy"],
    persona: `You are the DevOps Officer. You design branches, environments, GitHub Actions, Vercel deployments, release notes, migrations, rollback plans, build logs, and operational runbooks.`
  },
  administrator: {
    id: "administrator", name: "Administrator", emoji: "🗂️",
    role: "Academic Operations", layer: "Operations",
    color: "#60a5fa", bg: "#172554",
    quick: ["Design course nomenclature","Build academic calendar","Set capacity rules","Define teacher assignment rules"],
    persona: `You are the Academic Administrator. You govern academic periods, course codes, enrollment windows, capacity, teacher assignments, waitlists, publishing rules, and registrar-style workflows.`
  },
  custodian: {
    id: "custodian", name: "Content Custodian", emoji: "📋",
    role: "Instructional Quality", layer: "Learning",
    color: "#fb923c", bg: "#431407",
    quick: ["Audit course completeness","Create pre-publish checklist","Improve module sequence","Write rubric standards"],
    persona: `You are the Content Custodian, guardian of instructional quality. You audit syllabi, outcomes, modules, learning objects, rubrics, completion criteria, naming, and pedagogical flow.`
  },
  tutor: {
    id: "tutor", name: "AI Tutor Designer", emoji: "🧠",
    role: "Adaptive Learning & AI Tutor", layer: "Learning",
    color: "#c084fc", bg: "#3b0764",
    quick: ["Design AI tutor memory","Create adaptive path logic","Plan spaced repetition","Write tutor guardrails"],
    persona: `You are the AI Tutor Designer. You design adaptive learning, safe tutoring, retrieval context, learner memory, knowledge graphs, spaced repetition, and teacher-controlled AI boundaries.`
  },
  data: {
    id: "data", name: "Data Scientist", emoji: "📈",
    role: "Analytics & Learning Metrics", layer: "Insights",
    color: "#a3e635", bg: "#1a2e05",
    quick: ["Define learning KPIs","Design analytics schema","Create retention model","Build teacher dashboard metrics"],
    persona: `You are the Data Scientist. You define learning analytics, engagement metrics, progress models, grade insights, retention signals, and responsible AI/data practices.`
  },
  writer: {
    id: "writer", name: "Technical Writer", emoji: "✍️",
    role: "Docs, ADRs & Runbooks", layer: "Knowledge",
    color: "#e5e7eb", bg: "#27272a",
    quick: ["Write README","Create ADR template","Draft contributor guide","Generate release notes"],
    persona: `You are the Technical Writer. You create clear docs, ADRs, runbooks, onboarding guides, API references, release notes, and project memory summaries.`
  },
  wildcard: {
    id: "wildcard", name: "The Wildcard", emoji: "🃏",
    role: "Innovation & Provocation", layer: "Vision",
    color: "#d946ef", bg: "#4a044e",
    quick: ["Pitch a never-seen feature","Make this viral","Gamify the LMS","Design future-state experience"],
    persona: `You are The Wildcard. You reject conventional LMS thinking. Propose bold, weird, feasible ideas inspired by games, social platforms, creative tools, AI, and learning science.`
  },
};

const DOCS = [
  {
    id: "vision",
    icon: "🎯",
    title: "Vision",
    body: `# Vision\n\nChurchCore Academy should be fast, simple, ministry/academic-ready, and AI-augmented.\n\n## Outcomes\n- Teachers publish high-quality learning pathways quickly\n- Students receive clear progress and safe AI support\n- Admins trust enrollment, grade, and certificate workflows\n- Governance remains auditable and releasable each sprint`,
  },
  {
    id: "architecture",
    icon: "🏛️",
    title: "Architecture",
    body: `# Architecture\n\n- Next.js App Router UI + API routes\n- Supabase Postgres + RLS as source of truth\n- Storage for artifacts and uploads\n- Realtime for operational updates\n- Edge route for AI streaming proxy`,
  },
  {
    id: "schema",
    icon: "🗄️",
    title: "Schema Blueprint",
    body: `# Schema Blueprint\n\nProject HQ tables:\n- hq_sessions\n- hq_tasks\n- hq_risks\n- hq_decisions\n\nAll persisted with role-gated RLS policies and idempotent seed rows.`,
  },
  {
    id: "rls",
    icon: "🛡️",
    title: "Security + RLS",
    body: `# Security + RLS\n\n- Never trust client-only role checks\n- Every readable path must be backed by RLS\n- Managers/admins can mutate governance tables\n- Teachers can read governance state\n- Session memory is user-owned except admin read-all`,
  },
  {
    id: "workflow",
    icon: "⚙️",
    title: "Workflow Engine",
    body: `# Workflow Engine\n\nStatuses:\n- backlog\n- ready\n- in_progress\n- review\n- blocked\n- done\n\nSources:\n- manual\n- risk\n- council`,
  },
  {
    id: "github",
    icon: "🔀",
    title: "GitHub Governance",
    body: `# GitHub Governance\n\n- Branch pattern: feature/<phase>-<name> or fix/<name>\n- Required verification: test + lint + build\n- PR includes what changed, why, tests, ADR reference\n- Squash merge to main`,
  },
  {
    id: "roadmap",
    icon: "🗺️",
    title: "Roadmap",
    body: `# Roadmap\n\n1. Governance foundation\n2. Course + enrollment core\n3. Gradebook + submissions\n4. Analytics + AI tutor safety\n5. Release hardening and runbooks`,
  },
  {
    id: "llis_governance",
    icon: "📜",
    title: "LLIS Governance",
    body: `# LLIS Governance\n\nSource: ADR-2025-007 (Council Review)\n\n## Approval Status\n- Conditional approval with phasing mandate\n- Phase gates required before progression\n\n## Required Layering\n- Layer A (foundation first): behavioral event infrastructure, consent framework, memory vault, scoring/snapshot pipeline\n- Layer B (only after Layer A quality gates): learner-facing mirror, energy check-ins, living credentials, social/predictive surfaces\n\n## Non-Negotiable Rules\n- Consent-first writes: no LLIS write path without active consent checks\n- RLS-first access: no client trust for authorization\n- Event sourcing is source of truth: append-only events + versioned snapshots\n- AI is assistive, not authoritative: human review required for interventions and sensitive narratives\n- Learner safety framing: do not expose negative predictive indicators directly to learners\n\n## Phase Gates\n1. Phase 1 -> 2: privacy impact assessment approved + RLS tests passing\n2. Phase 2 -> 3: signal quality validation + security audit\n3. Phase 3 -> 4: data sufficiency period + legal/privacy review for social/predictive expansion\n\n## Product Naming\n- Product identity is ChurchCore Academy`,
  },
] as const;

const NAV = [
  { id: "dashboard", icon: "◈", label: "HQ" },
  { id: "agents", icon: "⚡", label: "Agents" },
  { id: "docs", icon: "📄", label: "Docs" },
  { id: "history", icon: "🕒", label: "History" },
  { id: "tasks", icon: "✅", label: "Tasks" },
  { id: "decisions", icon: "🧠", label: "Memory" },
  { id: "risks", icon: "⚠️", label: "Risks" },
  { id: "release", icon: "🚢", label: "Release" },
] as const;

const KANBAN: Array<{ id: HqTaskStatus; label: string }> = [
  { id: "backlog", label: "Backlog" },
  { id: "ready", label: "Ready" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

const releaseChecklist = [
  "Schema migrations applied with rollback notes",
  "RLS policies validated with role-path tests",
  "API and UI happy-path + edge-case tests green",
  "Security review completed for new data paths",
  "Docs and ADR updates merged",
  "Monitoring + alerting baselines confirmed",
  "Release communication and owner handoff complete",
];

const envMatrix = [
  { name: "local", status: "ready" },
  { name: "preview", status: "ready" },
  { name: "staging", status: "ready" },
  { name: "production", status: "gated" },
];

const layerOrder = ["Executive", "Build", "Assurance", "Operations", "Learning", "Insights", "Knowledge", "Vision"];
type DocId = (typeof DOCS)[number]["id"];

function groupAgents() {
  const grouped = new Map<string, AgentDef[]>();
  Object.values(AGENTS).forEach((agent) => {
    const current = grouped.get(agent.layer) ?? [];
    current.push(agent);
    grouped.set(agent.layer, current);
  });
  return layerOrder
    .filter((layer) => grouped.has(layer))
    .map((layer) => ({ layer, agents: grouped.get(layer)! }));
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function classFor(source: HqTaskSource) {
  if (source === "risk") return "pill risk";
  if (source === "council") return "pill council";
  return "pill";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}

async function readResponseError(response: Response) {
  const headerMessage = response.headers.get("x-ai-error-message");
  if (headerMessage) {
    return headerMessage;
  }

  const raw = await response.text().catch(() => "");

  if (!raw) {
    return "AI request failed.";
  }

  try {
    return getErrorMessage(JSON.parse(raw), "AI request failed.");
  } catch {
    return raw;
  }
}

export default function HQPage() {
  const hasPublicSupabaseEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const supabase = useMemo(
    () => (hasPublicSupabaseEnv ? createClient() : null),
    [hasPublicSupabaseEnv],
  );
  const authUidRef = useRef<string | null>(null);
  const streamingRef = useRef("");

  const [view, setView] = useState<ViewId>("dashboard");
  const [activeAgent, setActiveAgent] = useState("architect");
  const [activeDoc, setActiveDoc] = useState<DocId>(DOCS[0].id);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [sessions, setSessions] = useState<HqSession[]>([]);
  const [tasks, setTasks] = useState<HqTask[]>([]);
  const [risks, setRisks] = useState<HqRisk[]>([]);
  const [decisions, setDecisions] = useState<HqDecision[]>([]);
  const [selectedSession, setSelectedSession] = useState<HqSession | null>(null);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [feature, setFeature] = useState("AI-assisted gradebook with teacher override and student progress explanations");
  const [copied, setCopied] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [savingRiskId, setSavingRiskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupedAgents = useMemo(() => groupAgents(), []);
  const currentAgent = AGENTS[activeAgent] ?? AGENTS.architect;

  const hydrate = useCallback(async () => {
    if (!supabase) {
      setError("HQ requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
      return;
    }

    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be authenticated to use HQ.");
      return;
    }

    authUidRef.current = user.id;

    const [sessionRes, taskRes, riskRes, decisionRes] = await Promise.all([
      supabase.from("hq_sessions").select("*").order("created_at", { ascending: true }),
      supabase.from("hq_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("hq_risks").select("*").order("severity", { ascending: false }),
      supabase.from("hq_decisions").select("*").order("created_at", { ascending: false }),
    ]);

    if (sessionRes.error || taskRes.error || riskRes.error || decisionRes.error) {
      setError(
        getErrorMessage(
          sessionRes.error ?? taskRes.error ?? riskRes.error ?? decisionRes.error,
          "Failed to load HQ data.",
        ),
      );
      return;
    }

    const loadedSessions = (sessionRes.data ?? []) as HqSession[];
    const loadedTasks = (taskRes.data ?? []) as HqTask[];
    const loadedRisks = (riskRes.data ?? []) as HqRisk[];
    const loadedDecisions = (decisionRes.data ?? []) as HqDecision[];

    setSessions(loadedSessions);
    setTasks(loadedTasks);
    setRisks(loadedRisks);
    setDecisions(loadedDecisions);

    const rebuilt: Record<string, ChatMessage[]> = {};
    for (const session of loadedSessions) {
      rebuilt[session.agent_id] = rebuilt[session.agent_id] ?? [];
      rebuilt[session.agent_id].push({ role: "user", content: session.prompt, ts: session.created_at, sessionId: session.id });
      rebuilt[session.agent_id].push({ role: "assistant", content: session.response, ts: session.created_at, sessionId: session.id });
    }
    setMessages(rebuilt);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hydrate();
  }, [hydrate]);

  async function persistSession(agent: AgentDef, prompt: string, response: string) {
    if (!supabase) {
      throw new Error("HQ requires Supabase browser configuration.");
    }

    const { data, error: insertError } = await supabase
      .from("hq_sessions")
      .insert({
        agent_id: agent.id,
        agent_name: agent.name,
        prompt,
        response,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    const row = data as HqSession;
    setSessions((prev) => [...prev, row]);
    return row;
  }

  async function sendMessage(promptText?: string) {
    if (loading) return;

    const content = (promptText ?? input).trim();
    if (!content) return;

    setLoading(true);
    setError(null);

    const agent = currentAgent;
    const prior = messages[agent.id] ?? [];

    const userMessage: ChatMessage = { role: "user", content, ts: new Date().toISOString() };
    const assistantSeed: ChatMessage = { role: "assistant", content: "", ts: new Date().toISOString() };

    const next = [...prior, userMessage, assistantSeed];
    setMessages((prev) => ({ ...prev, [agent.id]: next }));
    setInput("");

    try {
      const reqBody = {
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        stream: true,
        system: `${agent.persona}\n\n${PROJECT_CONTEXT}`,
        messages: next
          .filter((m) => m.content.trim().length > 0)
          .map((m) => ({ role: m.role, content: m.content })),
      };

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok || !response.body) {
        throw new Error(await readResponseError(response));
      }

      streamingRef.current = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;

          try {
            const event = JSON.parse(raw) as Record<string, unknown>;
            if (event.type === "content_block_delta") {
              const delta = event.delta as { text?: string } | undefined;
              const chunk = delta?.text ?? "";
              if (!chunk) continue;

              streamingRef.current += chunk;
              setMessages((prev) => {
                const thread = [...(prev[agent.id] ?? [])];
                const idx = thread.length - 1;
                if (idx >= 0 && thread[idx].role === "assistant") {
                  thread[idx] = { ...thread[idx], content: streamingRef.current };
                }
                return { ...prev, [agent.id]: thread };
              });
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      const persisted = await persistSession(agent, content, streamingRef.current);
      setMessages((prev) => {
        const thread = [...(prev[agent.id] ?? [])];
        const idx = thread.length - 1;
        if (idx >= 0 && thread[idx].role === "assistant") {
          thread[idx] = { ...thread[idx], sessionId: persisted.id };
        }
        return { ...prev, [agent.id]: thread };
      });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message.");
    } finally {
      setLoading(false);
    }
  }

  async function dbAddTask(title: string, owner?: string | null, priority: HqTaskPriority = "P2", source: HqTaskSource = "manual") {
    if (!supabase) {
      throw new Error("HQ requires Supabase browser configuration.");
    }

    const { data, error: insertError } = await supabase
      .from("hq_tasks")
      .insert({ title, status: "backlog", owner, priority, source })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    const row = data as HqTask;
    setTasks((prev) => [row, ...prev]);
  }

  async function dbUpdateTaskStatus(taskId: string, status: HqTaskStatus) {
    if (!supabase) {
      throw new Error("HQ requires Supabase browser configuration.");
    }

    const old = tasks;
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));

    const { error: updateError } = await supabase.from("hq_tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", taskId);

    if (updateError) {
      setTasks(old);
      throw updateError;
    }
  }

  async function dbDeleteTask(taskId: string) {
    if (!supabase) {
      throw new Error("HQ requires Supabase browser configuration.");
    }

    const old = tasks;
    setTasks((prev) => prev.filter((task) => task.id !== taskId));

    const { error: deleteError } = await supabase.from("hq_tasks").delete().eq("id", taskId);
    if (deleteError) {
      setTasks(old);
      throw deleteError;
    }
  }

  async function runCouncilReview() {
    if (!supabase) {
      setError("HQ requires Supabase browser configuration.");
      return;
    }

    const prompt = `${CONSENSUS_PROMPT}${feature}`;
    setView("agents");
    setActiveAgent("product");

    await Promise.all([
      sendMessage(prompt),
      supabase.from("hq_decisions").insert({
        title: `Council review: ${feature}`,
        owner: "Product Manager",
        status: "Proposed",
        impact: "High",
      }),
      supabase.from("hq_tasks").insert({
        title: `Break down: ${feature}`,
        owner: "Product Manager",
        priority: "P1",
        status: "backlog",
        source: "council",
      }),
    ]);

    const [taskRes, decisionRes] = await Promise.all([
      supabase.from("hq_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("hq_decisions").select("*").order("created_at", { ascending: false }),
    ]);

    if (!taskRes.error) setTasks((taskRes.data ?? []) as HqTask[]);
    if (!decisionRes.error) setDecisions((decisionRes.data ?? []) as HqDecision[]);
  }

  async function convertRiskToTask(risk: HqRisk) {
    setSavingRiskId(risk.id);
    try {
      await dbAddTask(`Mitigate: ${risk.title}`, risk.owner, "P1", "risk");
      setView("tasks");
    } catch (riskError) {
      setError(riskError instanceof Error ? riskError.message : "Failed to convert risk to task.");
    } finally {
      setSavingRiskId(null);
    }
  }

  function copyText(id: string, text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1500);
  }

  function clearArchitectContext() {
    setMessages((prev) => ({ ...prev, architect: [] }));
    if (activeAgent === "architect") {
      setInput("");
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    window.location.href = "/login";
  }

  const sessionList = historyFilter === "all" ? sessions : sessions.filter((s) => s.agent_id === historyFilter);

  const activeCount = tasks.filter((task) => task.status !== "done").length;

  return (
    <div className="hq-app">
      <header className="hq-appbar">
        <div className="hq-appbar-inner">
          <div className="hq-lms-brand">ChurchCore Academy</div>
          <nav className="hq-lms-nav" aria-label="Academy HQ navigation">
            <Link href="/">Dashboard</Link>
            {NAV.filter((item) => ["dashboard", "agents", "docs", "tasks", "risks", "release"].includes(item.id)).map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  className={view === item.id ? "is-active" : ""}
                  onClick={() => setView(item.id as ViewId)}
                >
                  {item.label}
                </button>
              ),
            )}
          </nav>
          <div className="hq-app-actions">
            <label className="hq-search">
              <span>⌕</span>
              <input aria-label="Search" placeholder="Search" />
              <kbd>⌘K</kbd>
            </label>
            <button type="button" className="hq-icon-button" aria-label="Notifications">♧</button>
            <div className="hq-avatar" aria-label="Signed in user">R</div>
            <button type="button" className="hq-sign-out" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="hq-root">
        <aside className="hq-rail">
          <div className="hq-brand">LMS.<span>HQ</span></div>
          <nav className="hq-nav" aria-label="HQ navigation">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`hq-nav-item ${view === item.id ? "is-active" : ""}`}
                onClick={() => setView(item.id as ViewId)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

        <div className="hq-rail-footer">
          <span className="hq-footer-mark">N</span>
        </div>
      </aside>

      <main className="hq-main">
        <header className="hq-topbar">
          <div>
            <h1>AI Project Headquarters</h1>
            <p>ChurchCore LMS · agent council · governance memory · release discipline</p>
          </div>
          <div className="hq-review-runner">
            <input
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
              aria-label="Council review feature"
            />
            <button type="button" onClick={() => void runCouncilReview()} disabled={loading}>
              Run Council Review
            </button>
          </div>
        </header>

        {error ? <div className="hq-error">{error}</div> : null}

        {view === "dashboard" ? (
          <section className="hq-dashboard-grid">
            <article className="hq-panel hero">
              <h2>From idea to governed implementation.</h2>
              <p>AI-assisted operating system: agents, documentation, risk, decisions, tasks, releases, and implementation discipline in one place.</p>
              <div className="stats">
                <div><strong>{Object.keys(AGENTS).length}</strong><span>Specialist Agents</span></div>
                <div><strong>{DOCS.length}</strong><span>Docs</span></div>
                <div><strong>{sessions.length}</strong><span>Council Sessions</span></div>
                <div><strong>{activeCount}</strong><span>Active Tasks</span></div>
              </div>
            </article>

            <article className="hq-panel">
              <h3>Operating Model</h3>
              <ol>
                <li>Feature intake creates a council review.</li>
                <li>Council review creates decisions and tasks.</li>
                <li>Tasks map to agents and release gates.</li>
                <li>Docs and ADRs become institutional memory.</li>
                <li>Security and tests are required before release.</li>
              </ol>
            </article>

            <article className="hq-panel span-2">
              <h3>Agent Council</h3>
              <div className="agent-grid">
                {Object.values(AGENTS).map((agent) => (
                  <button
                    key={agent.id}
                    data-agent={agent.id}
                    type="button"
                    className="agent-card"
                    onClick={() => {
                      setActiveAgent(agent.id);
                      setView("agents");
                    }}
                  >
                    <div className="agent-title">{agent.emoji} {agent.name}</div>
                    <small>{agent.role}</small>
                  </button>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {view === "agents" ? (
          <section className="split-view">
            <aside className="left-panel">
              {groupedAgents.map((group) => (
                <div key={group.layer} className="agent-layer-group">
                  <h4>{group.layer}</h4>
                  {group.agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      data-agent={agent.id}
                      className={`agent-list-item ${activeAgent === agent.id ? "is-active" : ""}`}
                      onClick={() => setActiveAgent(agent.id)}
                    >
                      <div>{agent.emoji} {agent.name}</div>
                      <small>{(messages[agent.id] ?? []).filter((m) => m.role === "assistant").length} responses</small>
                    </button>
                  ))}
                </div>
              ))}
            </aside>
            <article className="right-panel">
              <header data-agent={currentAgent.id} className="agent-header">
                <div>
                  <h3>{currentAgent.emoji} {currentAgent.name}</h3>
                  <p>{currentAgent.role}</p>
                </div>
                {currentAgent.id === "architect" ? (
                  <button type="button" className="context-clear-button" onClick={clearArchitectContext}>
                    Clear Architect Context
                  </button>
                ) : null}
              </header>

              <div className="quick-row">
                {currentAgent.quick.map((q) => (
                  <button key={q} type="button" onClick={() => void sendMessage(q)}>{q}</button>
                ))}
              </div>

              <div className="chat-thread">
                {(messages[currentAgent.id] ?? []).map((m, index) => (
                  <div key={`${m.ts}-${index}`} className={`msg ${m.role}`}>
                    {m.content || (m.role === "assistant" ? "…" : "")}
                  </div>
                ))}
              </div>

              <div className="composer">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask this agent…"
                />
                <button type="button" onClick={() => void sendMessage()} disabled={loading || !input.trim()}>
                  {loading ? "Streaming…" : "Send"}
                </button>
              </div>
            </article>
          </section>
        ) : null}

        {view === "docs" ? (
          <section className="split-view">
            <aside className="left-panel docs-list">
              {DOCS.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className={activeDoc === doc.id ? "is-active" : ""}
                  onClick={() => setActiveDoc(doc.id)}
                >
                  <span>{doc.icon}</span> {doc.title}
                </button>
              ))}
            </aside>
            <article className="right-panel doc-body">
              {(() => {
                const doc = DOCS.find((d) => d.id === activeDoc) ?? DOCS[0];
                return (
                  <>
                    <div className="doc-header">
                      <h3>{doc.icon} {doc.title}</h3>
                      <button type="button" onClick={() => copyText(`doc:${doc.id}`, doc.body)}>
                        {copied === `doc:${doc.id}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre>{doc.body}</pre>
                  </>
                );
              })()}
            </article>
          </section>
        ) : null}

        {view === "history" ? (
          <section className="split-view">
            <aside className="left-panel history-list">
              <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}>
                <option value="all">All agents</option>
                {Object.values(AGENTS).map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>

              {sessionList
                .slice()
                .reverse()
                .map((session) => {
                  const agent = AGENTS[session.agent_id] ?? AGENTS.architect;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      data-agent={agent.id}
                      className={`history-item ${selectedSession?.id === session.id ? "is-active" : ""}`}
                      onClick={() => setSelectedSession(session)}
                    >
                      <strong>{agent.emoji} {agent.name}</strong>
                      <small>{formatDate(session.created_at)}</small>
                      <p>{session.prompt.slice(0, 120)}{session.prompt.length > 120 ? "…" : ""}</p>
                    </button>
                  );
                })}
            </aside>
            <article className="right-panel">
              {selectedSession ? (
                <div className="history-detail">
                  <h3>{selectedSession.agent_name}</h3>
                  <small>{formatDate(selectedSession.created_at)}</small>

                  <div className="detail-block">
                    <div>
                      <strong>Prompt</strong>
                      <button type="button" onClick={() => copyText(`prompt:${selectedSession.id}`, selectedSession.prompt)}>
                        {copied === `prompt:${selectedSession.id}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre>{selectedSession.prompt}</pre>
                  </div>

                  <div className="detail-block">
                    <div>
                      <strong>Response</strong>
                      <button type="button" onClick={() => copyText(`response:${selectedSession.id}`, selectedSession.response)}>
                        {copied === `response:${selectedSession.id}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre>{selectedSession.response}</pre>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveAgent(selectedSession.agent_id);
                      setView("agents");
                    }}
                  >
                    Open in Agent →
                  </button>
                </div>
              ) : (
                <p>Select a session to inspect full transcript.</p>
              )}
            </article>
          </section>
        ) : null}

        {view === "tasks" ? (
          <section className="hq-panel">
            <div className="task-header">
              <h3>Tasks ({activeCount} active)</h3>
              <div className="task-add">
                <input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add task title"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTaskTitle.trim()) {
                      void dbAddTask(newTaskTitle.trim()).then(() => setNewTaskTitle(""));
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newTaskTitle.trim()) return;
                    void dbAddTask(newTaskTitle.trim()).then(() => setNewTaskTitle(""));
                  }}
                >
                  Add Task
                </button>
              </div>
            </div>

            <div className="kanban-grid">
              {KANBAN.map((column) => (
                <div key={column.id} className="kanban-col">
                  <h4>{column.label}</h4>
                  {tasks.filter((task) => task.status === column.id).map((task) => (
                    <article key={task.id} className="task-card">
                      <div className="task-title">{task.title}</div>
                      <div className="task-meta">
                        {task.owner ? <span>{task.owner}</span> : null}
                        <span className="pill">{task.priority}</span>
                        {task.source !== "manual" ? <span className={classFor(task.source)}>{task.source}</span> : null}
                      </div>
                      <div className="task-actions">
                        <select
                          value={task.status}
                          onChange={(e) => void dbUpdateTaskStatus(task.id, e.target.value as HqTaskStatus)}
                        >
                          {KANBAN.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => void dbDeleteTask(task.id)}>
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {view === "decisions" ? (
          <section className="hq-panel">
            <h3>Decision Memory</h3>
            <div className="list-grid">
              {decisions.map((decision) => (
                <article key={decision.id} className="list-row">
                  <div>
                    <strong>{decision.title}</strong>
                    <small>{formatDate(decision.created_at)}</small>
                  </div>
                  <span>{decision.owner ?? "—"}</span>
                  <span className="pill">{decision.status}</span>
                  <span className="pill amber">{decision.impact}</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {view === "risks" ? (
          <section className="hq-panel">
            <h3>Risk Register</h3>
            <div className="list-grid">
              {risks.map((risk) => (
                <article key={risk.id} className="risk-row">
                  <div>
                    <strong>{risk.title}</strong>
                    <p>{risk.mitigation ?? "No mitigation captured."}</p>
                  </div>
                  <div>S{risk.severity}/P{risk.probability}</div>
                  <div>{risk.owner ?? "Unassigned"}</div>
                  <button
                    type="button"
                    disabled={savingRiskId === risk.id}
                    onClick={() => void convertRiskToTask(risk)}
                  >
                    {savingRiskId === risk.id ? "…" : "→ Task"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {view === "release" ? (
          <section className="release-grid">
            <article className="hq-panel">
              <h3>Release Pre-flight</h3>
              <ul className="release-list">
                {releaseChecklist.map((item) => (
                  <li key={item}>
                    <input type="checkbox" aria-label={item} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="hq-panel">
              <h3>Environment Matrix</h3>
              <ul className="env-list">
                {envMatrix.map((env) => (
                  <li key={env.name}>
                    <span>{env.name}</span>
                    <span className={`pill ${env.status === "ready" ? "green" : "amber"}`}>{env.status}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        ) : null}
      </main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .hq-app{min-height:100vh;background:#090a0f;color:#f5f7fb;font-family:Inter,system-ui,sans-serif}
          .hq-appbar{height:68px;background:#111827;border-bottom:1px solid rgba(148,163,184,.16);display:flex;align-items:center;position:sticky;top:0;z-index:20}
          .hq-appbar-inner{width:100%;display:flex;align-items:center;gap:28px;padding:0 38px 0 42px}
          .hq-lms-brand{font-weight:850;letter-spacing:-.04em;color:#fff;white-space:nowrap}
          .hq-lms-nav{display:flex;align-items:center;gap:28px;flex:1;min-width:0}
          .hq-lms-nav a,.hq-lms-nav button{border:0;background:transparent;color:#96a3b7;text-decoration:none;font:inherit;font-weight:680;font-size:15px;white-space:nowrap;cursor:pointer;padding:0}
          .hq-lms-nav a:hover,.hq-lms-nav button:hover,.hq-lms-nav button.is-active{color:#f8fafc}
          .hq-app-actions{display:flex;align-items:center;gap:16px}
          .hq-search{height:40px;display:flex;align-items:center;gap:10px;border:1px solid rgba(148,163,184,.2);background:#1d2636;color:#93a3b8;border-radius:10px;padding:0 10px 0 12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
          .hq-search input{width:112px;border:0;background:transparent;color:#dbe4f0;outline:0;font:inherit}
          .hq-search input::placeholder{color:#93a3b8}
          .hq-search kbd{border:1px solid rgba(148,163,184,.18);background:#344158;color:#aab7c9;border-radius:6px;padding:2px 5px;font-size:10px}
          .hq-icon-button{width:32px;height:32px;border:0;background:transparent;color:#d9e6fb;cursor:pointer;font-size:20px}
          .hq-avatar{width:38px;height:38px;border-radius:999px;background:#2750b5;color:#fff;display:grid;place-items:center;font-weight:800}
          .hq-sign-out{border:0;background:transparent;color:#a7b2c5;text-decoration:none;font-weight:700;font-size:14px;white-space:nowrap;cursor:pointer}
          .hq-root{display:flex;min-height:calc(100vh - 68px);background:#090a0f;color:#e8edf7}
          .hq-rail{width:260px;flex:0 0 260px;background:#090a0f;border-right:1px solid rgba(148,163,184,.16);display:flex;flex-direction:column;padding:26px 14px 18px;gap:26px}
          .hq-brand{font-size:22px;font-weight:900;letter-spacing:-.05em;color:#fff;padding:0 8px}
          .hq-brand span{color:#7177ff}
          .hq-nav{display:flex;flex-direction:column;gap:8px}
          .hq-nav-item{height:50px;display:flex;gap:12px;align-items:center;padding:0 14px;border:1px solid transparent;background:transparent;color:#a7adba;border-radius:10px;cursor:pointer;text-align:left;font-weight:760}
          .hq-nav-item.is-active{border-color:rgba(148,163,184,.25);background:#1b1b26;color:#fff}
          .hq-nav-item:hover{color:#fff;background:#131620}
          .hq-rail-footer{margin-top:auto}
          .hq-footer-mark{width:44px;height:44px;border-radius:999px;background:#030405;border:1px solid rgba(255,255,255,.18);display:grid;place-items:center;font-weight:900;color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.05)}
          .hq-main{flex:1;display:flex;flex-direction:column;gap:22px;min-width:0}
          .hq-topbar{height:102px;display:flex;justify-content:space-between;gap:20px;align-items:center;border-bottom:1px solid rgba(148,163,184,.14);padding:0 28px}
          .hq-topbar h1{margin:0;font-size:24px;letter-spacing:-.05em;color:#f8fafc}
          .hq-topbar p{margin:8px 0 0;color:#777884}
          .hq-review-runner{display:flex;gap:12px;align-items:center;min-width:min(740px,48vw)}
          .hq-review-runner input{flex:1;border:1px solid rgba(148,163,184,.18);background:#121219;color:#e7ebf3;border-radius:10px;padding:16px;font-weight:700;font-size:18px;min-width:0}
          .hq-review-runner button{border:0;background:#6661f4;color:white;padding:17px 18px;border-radius:10px;cursor:pointer;font-size:18px;font-weight:900;white-space:nowrap;box-shadow:0 18px 40px -24px rgba(102,97,244,.95)}
          .hq-review-runner button:disabled{opacity:.7;cursor:not-allowed}
          .hq-error{margin:0 28px;padding:12px 14px;border-radius:12px;border:1px solid rgba(248,113,113,.45);background:rgba(127,29,29,.32);color:#fecaca}
          .hq-panel{border:1px solid rgba(148,163,184,.18);background:#111116;border-radius:18px;padding:24px;box-shadow:0 28px 80px -48px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.03)}
          .hq-panel h3,.hq-panel h2{margin:0 0 14px;color:#f7f7fb}
          .hq-dashboard-grid{display:grid;grid-template-columns:2fr 1fr;gap:18px;padding:0 22px 28px}
          .span-2{grid-column:span 2}
          .hero{background:radial-gradient(circle at 6% 0%,rgba(107,98,255,.7),rgba(23,21,55,.55) 34%,rgba(17,17,22,.98) 69%),#111116;padding:32px 24px 28px}
          .hero h2{font-size:42px;letter-spacing:-.06em;line-height:1.08;margin-bottom:20px;color:#f5f7ff}
          .hero p{max-width:1040px;margin:0;color:#aaa8be;font-size:20px;line-height:1.45;font-weight:650}
          .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:30px}
          .stats div{border:1px solid rgba(148,163,184,.16);background:#090a0d;border-radius:14px;padding:20px 16px}
          .stats div:nth-child(1){border-color:rgba(113,119,255,.38)}
          .stats div:nth-child(2){border-color:rgba(56,189,248,.34)}
          .stats div:nth-child(3){border-color:rgba(132,204,22,.34)}
          .stats div:nth-child(4){border-color:rgba(245,158,11,.34)}
          .stats strong{display:block;font-size:38px;line-height:1;font-weight:950;color:#7d82ff;letter-spacing:-.07em}
          .stats div:nth-child(2) strong{color:#38bdf8}
          .stats div:nth-child(3) strong{color:#8cff2f}
          .stats div:nth-child(4) strong{color:#fbbf24}
          .stats span{display:block;margin-top:14px;font-size:13px;color:#7c7d88;text-transform:uppercase;letter-spacing:.12em;font-weight:750}
          .hq-panel ol{margin:18px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:17px;counter-reset:model-step}
          .hq-panel ol li{display:grid;grid-template-columns:28px 1fr;gap:16px;align-items:center;color:#d6d9e3;font-size:19px;font-weight:760;counter-increment:model-step}
          .hq-panel ol li::before{content:counter(model-step);width:28px;height:28px;border-radius:999px;background:#17182a;color:#858bff;display:grid;place-items:center;font-size:14px;font-weight:900}
          .agent-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
          .agent-card{min-height:138px;padding:20px 16px;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:#090a0d;color:#e5e7eb;text-align:left;cursor:pointer;display:flex;flex-direction:column;justify-content:center}
          .agent-card:hover{transform:translateY(-1px);border-color:var(--agent-color)}
          .agent-title{font-weight:850;margin-bottom:8px;font-size:18px;color:var(--agent-color)}
          .agent-title:first-letter{font-size:22px}
          .agent-card small{color:#777985;font-size:15px;font-weight:650}
          .split-view{display:grid;grid-template-columns:300px 1fr;gap:18px;min-height:70vh;padding:0 22px 28px}
          .left-panel,.right-panel{border:1px solid rgba(148,163,184,.18);background:#111116;border-radius:18px;padding:16px;overflow:auto}
          .agent-layer-group{margin-bottom:14px}
          .agent-layer-group h4{margin:0 0 8px;color:#7d8290;font-size:12px;text-transform:uppercase;letter-spacing:.1em}
          .agent-list-item{width:100%;text-align:left;padding:10px;border:1px solid rgba(148,163,184,.18);background:#0b0c11;border-radius:10px;color:#dce3ee;cursor:pointer;margin-bottom:8px}
          .agent-list-item.is-active{border-color:var(--agent-color);background:#151621}
          .agent-list-item small{color:#7d8290}
          .agent-header{padding:14px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:linear-gradient(145deg,rgba(26,27,38,.95),rgba(13,14,20,.96));display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
          .agent-header h3{margin:0 0 4px}
          .agent-header p{margin:0;color:#8b92a0}
          .context-clear-button{border:1px solid rgba(129,140,248,.45);background:#151621;color:#c7d2fe;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:850;white-space:nowrap;cursor:pointer}
          .context-clear-button:hover{border-color:#818cf8;color:#fff}
          .quick-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
          .quick-row button{border:1px solid rgba(148,163,184,.18);background:#161821;color:#dce3ee;border-radius:999px;padding:7px 11px;cursor:pointer;font-size:12px}
          .chat-thread{display:flex;flex-direction:column;gap:8px;min-height:320px;max-height:54vh;overflow:auto;padding-right:4px}
          .msg{padding:10px;border-radius:12px;border:1px solid rgba(148,163,184,.18);font-family:'JetBrains Mono',Menlo,monospace;font-size:12.5px;white-space:pre-wrap;color:#e5e7eb}
          .msg.user{margin-left:auto;max-width:72%;background:#4f46e5;border-color:#6d6af5;color:#fff}
          .msg.assistant{background:#0b0c11}
          .composer{display:flex;gap:8px;margin-top:12px}
          .composer textarea{flex:1;min-height:88px;border:1px solid rgba(148,163,184,.18);background:#0b0c11;color:#e5e7eb;border-radius:10px;padding:10px}
          .composer button{align-self:end;border:0;background:#6661f4;color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer;font-weight:800}
          .docs-list button{width:100%;display:flex;gap:8px;align-items:center;text-align:left;border:1px solid rgba(148,163,184,.18);background:#0b0c11;color:#dce3ee;padding:10px;border-radius:10px;margin-bottom:8px;cursor:pointer}
          .docs-list button.is-active{border-color:#6661f4;background:#151621}
          .doc-body pre,.history-detail pre{background:#0b0c11;border:1px solid rgba(148,163,184,.18);border-radius:10px;padding:12px;white-space:pre-wrap;font-family:'JetBrains Mono',Menlo,monospace;font-size:12px;max-height:50vh;overflow:auto;color:#dce3ee}
          .doc-header,.detail-block>div{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
          .history-list select{width:100%;margin-bottom:10px;background:#0b0c11;color:#dce3ee;border:1px solid rgba(148,163,184,.18);border-radius:10px;padding:8px}
          .history-item{width:100%;text-align:left;border:1px solid rgba(148,163,184,.18);background:#0b0c11;color:#dce3ee;padding:10px;border-radius:10px;margin-bottom:8px;cursor:pointer}
          .history-item.is-active{border-color:var(--agent-color);background:#151621}
          .history-item p{margin:6px 0 0;color:#7d8290;font-size:12px}
          .task-header{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
          .task-add{display:flex;gap:8px;min-width:380px}
          .task-add input{flex:1;border:1px solid rgba(148,163,184,.18);background:#0b0c11;color:#e5e7eb;border-radius:10px;padding:8px}
          .task-add button{border:0;background:#6661f4;color:#fff;border-radius:10px;padding:8px 10px;cursor:pointer;font-weight:800}
          .kanban-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
          .kanban-col{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:#0b0c11;padding:8px;min-height:220px}
          .kanban-col h4{margin:0 0 8px;font-size:13px;color:#aab2c0}
          .task-card{border:1px solid rgba(148,163,184,.16);background:#14151d;border-radius:10px;padding:8px;margin-bottom:8px}
          .task-title{font-weight:600;font-size:13px;margin-bottom:6px}
          .task-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:11px;color:#8b92a0;margin-bottom:6px}
          .task-actions{display:flex;gap:6px}
          .task-actions select,.task-actions button{border:1px solid rgba(148,163,184,.18);background:#0b0c11;color:#dce3ee;border-radius:8px;padding:4px 6px;font-size:12px}
          .list-grid{display:flex;flex-direction:column;gap:8px}
          .list-row,.risk-row{display:grid;grid-template-columns:1.8fr .8fr .8fr .7fr;gap:8px;align-items:center;border:1px solid rgba(148,163,184,.18);background:#0b0c11;border-radius:10px;padding:10px}
          .risk-row p{margin:4px 0 0;color:#8b92a0;font-size:12px}
          .risk-row button{border:0;background:#6661f4;color:#fff;border-radius:8px;padding:6px 8px;cursor:pointer;font-weight:800}
          .release-grid{display:grid;grid-template-columns:2fr 1fr;gap:14px}
          .release-list,.env-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
          .release-list li,.env-list li{display:flex;gap:8px;align-items:center;border:1px solid rgba(148,163,184,.18);background:#0b0c11;border-radius:10px;padding:8px}
          .pill{display:inline-flex;align-items:center;border:1px solid rgba(148,163,184,.24);border-radius:999px;padding:2px 8px;font-size:11px;color:#dce3ee;background:#151621}
          .pill.green{border-color:#22c55e55;background:#052e1a;color:#86efac}
          .pill.pink{border-color:#ec489955;background:#3b1028;color:#f9a8d4}
          .pill.amber{border-color:#f59e0b55;background:#3a2505;color:#fcd34d}
          .pill.risk{border-color:#ef444455;background:#3a1010;color:#fecaca}
          .pill.council{border-color:#818cf855;background:#1f2148;color:#c7d2fe}
          @media (max-width: 1280px){.hq-lms-nav{gap:14px}.hq-lms-nav a{font-size:14px}.kanban-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.agent-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
          @media (max-width: 1000px){.hq-appbar{height:auto}.hq-appbar-inner{padding:14px;flex-wrap:wrap}.hq-root{flex-direction:column}.hq-rail{width:auto;flex:unset}.hq-topbar{height:auto;padding:20px;align-items:stretch;flex-direction:column}.hq-review-runner{min-width:0;width:100%}.split-view{grid-template-columns:1fr}.hq-dashboard-grid,.release-grid{grid-template-columns:1fr;padding:0 14px 20px}.span-2{grid-column:auto}.task-add{min-width:0;width:100%}.task-header{flex-direction:column;align-items:stretch}}
          ${Object.values(AGENTS)
            .map(
              (agent) => `
            [data-agent="${agent.id}"]{--agent-color:${agent.color};--agent-bg:${agent.bg}}
            [data-agent="${agent.id}"].agent-card{border-color:${agent.color}55;background:#090a0d}
            [data-agent="${agent.id}"].agent-header,[data-agent="${agent.id}"].history-item{border-color:${agent.color}66}
          `,
            )
            .join("\n")}
        `,
        }}
      />
    </div>
  );
}
