# ADR 0070: Shared OpenRouter LLM Gateway For Administrative Wording Assistance

Date: 2026-09-13
Status: proposed

---

## Context

CLAUDE.md Rule 3 permits ShepherdAI to use "optional LLM assistance limited to wording and administrative support content" — never for signal detection, scoring, or decision-making, and never as a chatbot. Until now, no LLM has been wired into ChurchCore Academy at all: the ShepherdAI signal engine (`src/modules/shepherd-ai/`, `src/modules/academic-workflows/`) is 100% deterministic, and the codebase has zero LLM API integration (confirmed by the 2026-09-12 feature audit).

The company wants to enable actual LLM-assisted wording generation — e.g., drafting an advising follow-up email, a warning-notice template, or administrative correspondence text — for a human to review and edit before it's ever sent, using a **company-wide shared OpenRouter subscription** (one account, potentially used by other ChurchCore products too, not a per-tenant billing relationship) rather than each institution or product bringing its own LLM API key.

This is a genuine "adding a stack" decision under CLAUDE.md Rule 5, and it touches student-record-adjacent data, so it needs its own ADR and a privacy-first design before any code is written.

---

## Decision

Add a narrow, server-only **AI Gateway** module in Academy (`src/modules/ai-gateway/`) that:

1. Talks to OpenRouter (`https://openrouter.ai`) using a single shared API key, resolved at the route layer per CLAUDE.md's existing rule (never inside a domain/service function).
2. Accepts only a fixed, allow-listed set of **task types** (e.g., `advising_followup_draft`, `warning_notice_draft`, `admissions_correspondence_draft`) — never a freeform prompt passed through from a UI text box. Each task type has its own template and its own anonymization rule (below).
3. Anonymizes every request before it leaves Academy's boundary, using a freshly minted, single-use, unguessable reference token per call — never a stable pseudonym, never derived from the internal ID, never persisted or logged — so no stable identifier links two requests about the same student, or links a request to a real identity. This removes *direct* identifier correlation; it does not make requests unlinkable. Repeated allowed fields (signal type, urgency, program name), request timing, and provider-side metadata can still support probabilistic linkage, and that residual risk is accepted and minimized through the field allow-lists rather than claimed away. Full mechanism in the companion plan doc.
4. Returns a draft that a staff member must explicitly review, edit if needed, and approve before it is ever sent or saved as an official record. No auto-send, ever.
5. Is gated by a new institution capability flag (`aiWordingAssistance`), following the exact pattern already established for `shepherdAiRecommendations` and the other capability flags in `InstitutionCapabilitySet` — an institution that hasn't enabled it gets Ghost Mode (HTTP 451), same as any other disabled capability.
6. Logs every call to the existing immutable audit-event pattern: task type, model used, an opaque draft-request reference, and outcome (approved-as-is / edited / discarded) — **not** the raw prompt or raw completion text, to avoid retaining PII-adjacent content in audit storage longer than necessary. Token counts and cost live only in the usage record (item 7), not in audit metadata: `validateAuditMetadata()` rejects keys matching `/token|secret|password|authorization|raw|payload/i`, so fields like `promptTokens` would fail it, and loosening that validator would be a separate, security-reviewed change.
7. Tracks per-tenant token/cost consumption against the shared subscription, so no single institution's usage can silently dominate a company-wide bill (see the companion plan doc's metering design).

This module is **additive to ShepherdAI, not a replacement or extension of its signal engine.** ShepherdAI's `signal-aggregator.ts`, `retention-risk.ts`, `gpa-drop-evaluator.ts`, and `academic-standing-evaluator.ts` remain fully deterministic and untouched. The AI Gateway may be *called from* a ShepherdAI workflow-suggestion screen ("draft a message for this suggestion") but never *feeds into* signal detection or scoring.

The detailed technical plan — anonymization pipeline, model shortlist, evaluation framework, cost-metering schema, test plan — lives in `docs/superpowers/plans/2026-09-13-openrouter-ai-gateway-plan.md`.

---

## Consequences

**Easier:**

- Staff drafting repetitive correspondence (advising follow-ups, warning notices) get a starting draft instead of a blank page.
- A single shared subscription means no per-institution API key provisioning or billing relationship with OpenRouter.
- The task-type allow-list keeps this from sliding into general-purpose chat by construction, not just by policy.

**Harder:**

- Every new task type needs its own anonymization rule reviewed before it ships — this is a recurring cost, not a one-time setup.
- Shared-subscription cost attribution across tenants (and potentially across other ChurchCore products, if the key is ever reused outside this repo) requires real metering, not just trusting aggregate OpenRouter billing.

**Safer:**

- No student PII, grades, financial data, or free-text pastoral/formation notes leave Academy's boundary unredacted — enforced by the anonymization step, not by prompt instructions to the model.
- Per-call, single-use reference tokens mean OpenRouter (or any provider it routes to) cannot build a longitudinal profile of a pseudonymous student across requests, even in principle — there is no repeated identifier to correlate.
- The capability-flag gate means AI wording assistance is opt-in per institution, same governance posture as every other sensitive capability in this system.
- Human review before send/save means a bad or hallucinated draft never becomes an official record or a sent communication on its own.

**Riskier:**

- This is the first time any Academy data (even anonymized) leaves the system to a third-party inference provider. The anonymization pipeline is the single point of failure for this ADR's privacy claim — it needs its own dedicated test suite proving PII cannot leak through, not just unit tests of the happy path.
- OpenRouter routes to many underlying model providers; a model-provider or OpenRouter-side data-retention policy change could alter the privacy posture without ChurchCore changing anything. The plan doc's model shortlist must record each shortlisted model's data-retention terms, not just price/quality.

---

## Alternatives Considered

**Give each institution its own OpenRouter/OpenAI key:** Rejected for this ADR's scope — the company explicitly wants a shared subscription. Per-tenant keys would solve cost attribution "for free" but is a different, heavier product decision (institutions managing their own billing relationship with an AI vendor) that isn't what was asked for.

**Call a single model provider directly (e.g., OpenAI or Anthropic API) instead of OpenRouter:** Rejected for now. OpenRouter's value here is exactly the ask — "evaluate models against efficiency and consumption" implies comparing across providers/models, which is OpenRouter's core value proposition (one API, many models, transparent per-model pricing). A direct single-provider integration can be revisited later if OpenRouter's routing/pricing stops fitting.

**Build this as a chatbot / freeform assistant UI:** Rejected outright — directly contradicts CLAUDE.md Rule 3.

**Skip anonymization and rely on contractual data-processing terms with OpenRouter/model providers instead:** Rejected. Contractual terms are necessary but not sufficient given this is student data in a faith-based institution context; technical redaction is the primary control, contracts are a backstop.

**Do nothing (keep ShepherdAI 100% deterministic, no LLM anywhere):** Rejected — the company has explicitly asked to enable this capability now; the question this ADR answers is *how*, not *whether*.

---

## Review Notes

- Product boundary: administrative wording assistance only, gated by a new capability flag. No signal-detection, scoring, or autonomous-action use of the LLM. No chatbot UI.
- Security/privacy: this ADR requires a dedicated anonymization-pipeline test suite (see companion plan) proving no PII/PHI, secrets, or unredacted free-text fields reach OpenRouter, before this capability can be enabled for any tenant.
- Testing: `npm test`, `npm run lint`, `npm run build`, plus the anonymization-specific test suite, plus a cost-metering reconciliation check (sum of per-tenant logged usage matches OpenRouter's own billing for a given period, within rounding).
- Rollback: the capability flag is the rollback lever — disable `aiWordingAssistance` for a tenant (or all tenants) with no data migration required, since nothing this module produces is written to an official record without human approval first.
