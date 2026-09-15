# Shared OpenRouter AI Gateway — Implementation Plan

Date: 2026-09-13
Plan name: `2026-09-13-openrouter-ai-gateway-plan.md`
Governing ADR: `docs/adr/0070-shared-openrouter-llm-gateway.md`
Status: Planned

## Summary

Wire ChurchCore Academy to a company-shared OpenRouter subscription so staff can generate draft wording for administrative correspondence (advising follow-ups, warning notices, admissions replies) with a human required to review and approve every draft before it's sent or saved. All data leaving Academy's boundary is anonymized first. Model selection is driven by an ongoing evaluation harness scoring OpenRouter's catalog on both **efficiency** (output quality and latency for Academy's specific task types) and **consumption** (token cost per request against the shared subscription).

Reference: [OpenRouter API docs](https://openrouter.ai/docs) for request/response shape, model listing, and per-model pricing metadata used throughout this plan.

## Council Decision Required

Before implementation, this plan needs the same council-review treatment `docs/superpowers/plans/2026-09-12-oneroster-certification-ready-compliance-plan.md` got — this is a privacy-sensitive, ShepherdAI-adjacent change per CLAUDE.md Rule 0.

Council must ratify:

- The task-type allow-list (Section "Task types" below) is the complete initial scope. No freeform prompt input from any UI surface.
- Every task type's anonymization rule is reviewed and approved before that task type can be enabled for any tenant.
- `aiWordingAssistance` is an opt-in institution capability flag, off by default for every existing tenant.
- No draft is ever sent, saved as an official record, or surfaced to a student/guardian without an explicit staff approval action.
- The shared OpenRouter subscription is billed at the company level; per-tenant consumption is metered and reported, not billed directly to tenants, unless a separate pricing decision says otherwise.
- Formation records, pastoral notes, covenant/spiritual-profile data, and any other explicitly sensitive record types (per `docs/adr/0063-covenant-record-spiritual-profile-model.md`) are excluded from every task type's inputs until a separate privacy council amendment explicitly approves a specific use.
- This capability is Academy-only in this plan. If ChurchCore LMS, Ops, or Care later want to draw on the same shared OpenRouter subscription, that is a separate cross-product ADR, not an extension of this one.

## Data Flow And Anonymization Pipeline

This is the load-bearing part of the whole plan — everything else is ordinary CRUD-module work by comparison.

```mermaid
sequenceDiagram
    participant Staff as Staff (advisor/admin)
    participant UI as Admin UI (task-specific form)
    participant Gateway as ai-gateway module
    participant Redact as Anonymization step
    participant OR as OpenRouter
    participant Audit as Audit log

    Staff->>UI: Select task type + source record (e.g., a ShepherdAI suggestion)
    UI->>Gateway: requestDraft(actor, taskType, sourceRecordId)
    Gateway->>Gateway: Load source record fields allow-listed for this taskType
    Gateway->>Gateway: Mint a fresh random ephemeralRef (never derived from, or reused across calls for, the internal ID)
    Gateway->>Redact: Build payload using ephemeralRef in place of every real identifier; strip disallowed fields
    Redact->>Redact: Run independent content scanner over the final payload (fail closed)
    Redact-->>Gateway: Anonymized, scanner-cleared prompt payload (no PII, no secrets, no stable identifier)
    Gateway->>OR: Completion request (selected model, anonymized payload)
    OR-->>Gateway: Draft text (ephemeralRef-referenced, no real identifiers)
    Gateway->>Gateway: Rehydrate ephemeralRef back to real names/details (in-memory only) then drop the mapping
    Gateway->>Audit: Log task type, model, token/cost counts — NOT the ephemeralRef, NOT raw prompt/completion
    Gateway-->>UI: Rehydrated draft, editable
    Staff->>UI: Edit (optional) and approve
    UI->>Staff: Draft is now usable (send / save / copy) — never automatic
```

**Anonymization rules, concretely:**

- **Ephemeral, single-use correlation tokens, not stable pseudonyms.** Every person referenced in a prompt is stood in for by a token minted fresh for that one call — `crypto.randomBytes(32).toString("hex")`, drawn from a CSPRNG, **never derived from the internal ID** (no `hash(personId)` — a derived value is a target; a value with no mathematical relationship to the ID has nothing to reverse) and **never reused**, not even for the same student on a later call. The token-to-identity mapping is a plain local variable inside the request handler — it is never written to a database, a cache, a log, or an audit event, and it ceases to exist the moment the function returns; there is no cleanup job because there is nothing to clean up. This closes a risk stable pseudonyms don't: even fully scrubbed content sent under a *stable* label lets an external party build a longitudinal profile ("this pseudonym has been flagged at-risk 40 times this year") without ever learning a name. A token that's never repeated makes every call cryptographically unlinkable to every other call — there's no pattern to observe. See "Responsible Implementation Criteria" below for the code shape and its test coverage.
- **Field allow-listing per task type**, not a blanket redaction pass. Example for `advising_followup_draft`: allowed inputs are the ShepherdAI suggestion's signal type, urgency, and a pre-approved short description (e.g., "GPA trend below threshold") — explicitly **not** the student's name, ID, guardian contact info, or any free-text advising notes. The model receives "`<ephemeralRef>` has a GPA trend signal, urgency high" and drafts wording using that token as a placeholder, which the gateway substitutes with the real name only after the response comes back, then discards.
- **Hard-excluded field categories, every task type, no exceptions without a council amendment:** SSN/government ID, financial account numbers, payment tokens, formation/pastoral free-text notes, covenant/spiritual-profile fields, denomination/ordination free-text notes, guardian contact details, any field already covered by this repo's existing secret-redaction test convention (`doesNotMatch` checks).
- **Outbound payload size cap and schema validation:** the anonymized payload is built from a typed template per task type (not string concatenation of arbitrary record fields), so a future field added to a source record can't silently leak into a prompt just because someone changed an unrelated model. Adding a field to what a task type can see requires touching that task type's template explicitly.
- **Statelessness is a consequence, not a limitation:** because nothing about a call is retained, there is no way to "continue" a prior exchange — a revision request is a brand-new call with a brand-new token and the full context resent. This is consistent with (and reinforces) Rule 3's "not a chatbot" boundary: there is no conversation to have, only independent, one-shot draft requests.

## Task Types (Initial Allow-List)

| Task type | Source record | Allowed fields (anonymized) | Explicitly excluded |
|---|---|---|---|
| `advising_followup_draft` | `ShepherdAiSuggestion` | signal type, urgency, confidence band (not exact score), program name | student name/ID, notes, contact info |
| `warning_notice_draft` | `StudentAcademicStandingEvaluation` | standing type (`warning`/`probation`), triggering rule category (not full rule text if it contains PII) | student name/ID, GPA exact value (use a band: "below 2.0"), financial info |
| `admissions_correspondence_draft` | `AdmissionApplication` (from Section 3.1 of the competitive closure plan, once built) | application stage, program name, missing-document category | applicant name/contact, document content, essay/reference text |

Additional task types require a new row here and a council sign-off before implementation — this table is the enforcement mechanism, not just documentation.

## Responsible Implementation Criteria

The anonymization pipeline (identifier tokens + field allow-listing, above) is the single highest-risk piece of this entire plan — it's the first time any Academy data leaves the system to a third party, ever. "We wrote unit tests" is not sufficient evidence that it's safe. These six mechanisms are the actual bar, and `aiWordingAssistance` may not be enabled for any real tenant until all six are in place for every enabled task type.

**1. Fail-safe by construction, enforced by the type checker, not by convention.** `anonymizer.ts` builds each payload as an explicit allow-list literal —

```ts
// Right — a field newly added to the source type is excluded by default
const payload = { signalType: input.signalType, urgency: input.urgency };

// Wrong — a field newly added to the source type is included by default
const { studentName, ...payload } = input;
```

— plus a compile-time exhaustiveness helper mapping every key of each source type to `"allowed" | "excluded"`, so a field added to `ShepherdAiSuggestion` (or any other source type) without an explicit classification fails the build rather than silently shipping either way.

**2. An adversarial test suite, not a happy-path one.** A dedicated PII corpus fixture — realistic fake records with every field populated with PII-shaped content (names, emails, phone numbers, SSN-shaped strings, addresses, financial account numbers, free text with embedded PII like "call his mom Jane at 555-0199") — run against every task type's anonymizer, asserting via exact string search (not type-checking) that none of the injected values appear anywhere in the constructed payload. Include **poisoned-field tests**: inject PII into fields the allow-list *does* permit (e.g., `warning_notice_draft`'s "triggering rule category," flagged above as free-text-adjacent) to prove allowed-but-risky fields are actually sanitized, not just assumed safe. Fuzz with generated synthetic data across many iterations in addition to the fixed corpus.

**3. An independent second layer that doesn't trust the first.** This repo already has a fail-closed precedent for a related problem: `validateAuditMetadata()` in `src/modules/audit/postgres-repository.ts` rejects audit metadata whose **keys** match a secret-shaped pattern before persistence. That checks key names; this needs a sibling that checks **value content** — a regex-based scanner for email/phone/SSN-shaped strings, run over the *final constructed payload* immediately before the OpenRouter call, with no knowledge of which allow-list produced it. If it fires: reject the request (never redact-and-send), log it as a security event, and auto-disable `aiWordingAssistance` for that tenant pending investigation. A bug in the allow-list and a bug in the scanner would both have to fail identically to leak anything — that's what "independent" buys.

**4. A process gate, not just a code gate.** Every change to `anonymizer.ts`, any task-type template, or any source-record type a task type reads from requires a **Security and Privacy Council sign-off** before merge — the same council-review pattern already used for the institution-mode-pack and capability-enforcement work. `aiWordingAssistance` stays disabled for every tenant until that sign-off exists for the current state of every enabled task type.

**5. Schema drift is the real long-term threat, not day-one bugs.** The adversarial suite (item 2) must be wired to re-run automatically — via a path-based CI trigger — whenever `ShepherdAiSuggestion`, `StudentAcademicStandingEvaluation`, `AdmissionApplication`, or `anonymizer.ts` itself changes. A field silently added to a source table six months from now, not a bug shipped on day one, is the realistic way this leaks.

**6. Production isn't "done" either.** The runtime scanner (item 3) tripping in production is a P1 per `docs/runbooks/incident-response.md`, not a warning log. Add a small monthly manual-sampling review — a human spot-checks a sample of constructed payloads (still zero real PII by construction) — as the cheapest way to catch drift the automated suite didn't anticipate.

## Model Evaluation Framework (Efficiency And Consumption)

A small, repeatable evaluation harness — not a one-time choice baked into code:

- `scripts/evaluate-openrouter-models.ts` runs a fixed set of representative prompts (one or more per task type, using synthetic/fixture data, never real tenant data) against a shortlist of OpenRouter models.
- **Efficiency axis:** output quality scored against a rubric per task type (tone appropriateness, factual grounding to the anonymized inputs only, length/usability as a draft) — start with human-graded scoring for the initial shortlist; consider a cheap secondary-model grading pass later if manual scoring becomes a bottleneck. Latency (time-to-first-token and total completion time) recorded per model.
- **Consumption axis:** input/output token counts × OpenRouter's published per-model pricing, computed per representative prompt and extrapolated to expected monthly volume per task type.
- **Output:** a scored comparison table (quality, latency, cost-per-request, cost-at-expected-volume) plus each shortlisted model's data-retention/training-use policy (pulled from OpenRouter's model metadata and the underlying provider's terms) — a model that trains on inputs by default is disqualified regardless of score, since inputs may include anonymized-but-still-institution-specific data.
- **Configuration, not code, picks the model:** the selected default model (and a fallback if the default is unavailable) is a config value the gateway reads, not a hardcoded model string — re-running the evaluation and swapping the config is the intended way to react to OpenRouter catalog/pricing changes, targeted at a quarterly cadence.

## Cost / Consumption Metering

- `AiGatewayUsageRecord`: `tenantId`, `taskType`, `model`, `promptTokens`, `completionTokens`, `costUsd` (computed from OpenRouter's per-request cost metadata, not estimated), `createdAt`. One row per completed request.
- A per-tenant monthly consumption view/report (`getAiGatewayConsumption(tenantId, month)`), surfaced in the institution admin settings alongside the other capability tiles (matching the existing four-tile pattern on the institution settings page).
- A company-wide soft ceiling (config value, not hardcoded) that, if a tenant's monthly consumption trends toward it, triggers an internal alert — not an automatic cutoff of the tenant's capability, which would be a support/ops decision, not a code decision.
- Monthly reconciliation: sum of `AiGatewayUsageRecord.costUsd` for the period should match OpenRouter's own billing statement within rounding — a mismatch means the metering has a bug and needs to be treated as a P1, since it's the only thing standing between "shared subscription" and "one tenant burns the whole budget unnoticed."

## Service/API Surface

- `src/modules/ai-gateway/types.ts` — `AiTaskType`, `AiDraftRequest`, `AiDraftResult`, `AiGatewayUsageRecord`.
- `src/modules/ai-gateway/anonymizer.ts` — pure functions, one per task type, each independently unit-tested with adversarial inputs (fixtures that include PII in unexpected fields, to prove the allow-list approach actually excludes them rather than just not-including-by-convention).
- `src/modules/ai-gateway/openrouter-client.ts` — thin HTTP client; API key resolved at the route layer and passed in, per the constructor-injection pattern already used throughout this codebase (e.g., `PostgresAuditRepository`'s injected database client) — never `process.env` read inside this file.
- `src/modules/ai-gateway/service.ts` — `requestDraft(actor, taskType, sourceRecordId)`: loads the source record via the existing tenant-scoped repository for that record type (reuses `shepherd-ai`/`grading-records`/`admissions` repositories — does not duplicate their queries), anonymizes, calls the client, rehydrates, logs usage, returns the draft. Asserts `aiWordingAssistance` capability via the existing `assertCapability`/`withCapabilityContext` pattern before doing anything else.
- API routes under `src/app/api/academy/ai-gateway/draft/route.ts` (POST) and `src/app/api/academy/ai-gateway/consumption/route.ts` (GET, admin-only).

## UI Surface

- A "Draft with AI" action on the existing ShepherdAI suggestion card (`/admin/workflows`, `/faculty/shepherd`) for `advising_followup_draft`, and equivalent entry points on the academic-standing and admissions surfaces once their task types are enabled.
- A review modal: shows the draft, an explicit "This draft was AI-generated from anonymized data — review before use" notice, an editable text area, and Approve/Discard actions. Approving copies the (rehydrated, human-editable) text into the existing communications-compose flow — it does not send anything itself.
- A consumption tile on `/admin/settings/institution` (matching the existing four-tile pattern) showing this tenant's current-month usage against the company-wide context, admin-visible only.

## Test Plan

**Anonymization (highest priority, most coverage — see "Responsible Implementation Criteria" above for the full rationale):**
- For every task type: the adversarial PII-corpus test, string-search based, proving no excluded field's value appears anywhere in the constructed payload — including poisoned-field cases where PII is injected into an *allowed* field.
- A test proving `ephemeralRef` values are never reused across two calls (generate N tokens in a test loop, assert uniqueness) and never appear in `AiGatewayUsageRecord`, any audit event, or any persisted table — the mapping must be observable only as a local variable during the test, never anywhere durable.
- A test for the independent content scanner: feed it payloads with email/phone/SSN-shaped strings that the allow-list logic would have missed, and assert it rejects them (fail-closed) rather than silently stripping and continuing.
- A cross-tenant test proving a source record from tenant B can never be loaded into a tenant A draft request.
- An exhaustiveness test (or a type-level test) proving every field on each source type has an explicit allow/exclude classification — it should fail to compile or fail the test if a new field is added without one.

**Service/API:**
- Success, capability-disabled (451), and cross-tenant-rejection cases per this repo's standard convention, for every new service function.
- A test proving `requestDraft` never writes to any official record (transcript, grade, standing, admissions decision) — it only returns a string.

**Metering:**
- A test proving `AiGatewayUsageRecord` is written exactly once per completed request, with token/cost figures matching the OpenRouter response's own usage metadata (not independently re-estimated).

**Model evaluation harness:**
- Not part of `npm test` — it's an operational script run against synthetic fixtures, not real tenant data, on a quarterly cadence or when OpenRouter's catalog changes materially.

**Runtime verification:**
- `npm test && npm run lint && npm run build` plus a browser walkthrough: enable `aiWordingAssistance` for a demo tenant, generate a draft from a real (demo) ShepherdAI suggestion, confirm the review modal blocks any path to sending without explicit approval, confirm a disabled tenant gets Ghost Mode on the same UI entry point.

## Acceptance Criteria

- A staff member can generate an AI-drafted wording suggestion for each of the three initial task types, review it, edit it, and approve it — with no path that sends or saves anything without that approval step.
- No PII, secrets, financial data, or excluded free-text field content ever appears in a request sent to OpenRouter, proven by the anonymization test suite, not just by convention.
- Every identifier reference sent to OpenRouter is a freshly minted, single-use, unguessable token with no derivable relationship to the internal ID — never reused across calls, never persisted, never logged.
- The independent content scanner and the Security and Privacy Council sign-off are both in place for every enabled task type before `aiWordingAssistance` can be turned on for any tenant.
- Per-tenant consumption is metered and reconcilable against OpenRouter's own billing.
- The default model is a configuration value chosen via the evaluation harness's output, not hardcoded, and the harness can be re-run to justify changing it.
- `aiWordingAssistance` is off by default for every existing tenant and requires explicit institution-admin opt-in.
- ShepherdAI's existing deterministic signal engine is untouched — this capability is additive, never a dependency of any existing signal, score, or workflow-suggestion computation.

## Assumptions

- OpenRouter is the routing layer for all model calls in this plan — no direct single-provider integration in v1.
- The initial three task types are illustrative and gated by council sign-off per row in the task-type table; more can be added following the same review pattern.
- The shared subscription's billing relationship, contract terms, and data-retention agreement with OpenRouter are a business/legal matter outside this codebase — this plan assumes that agreement exists or will exist before any tenant's capability is turned on, and that its terms are at least as strict as what the anonymization pipeline already assumes (no training on inputs).
- This plan is Academy-only. Extending the shared subscription to other ChurchCore products is a separate decision and a separate metering/attribution design.
- Sequencing: this unblocks the "draft advising communication templates" sub-feature named as an explicit non-goal in `docs/superpowers/plans/2026-09-13-competitive-feature-closure-plan.md` section 3.6 — once this gateway exists, that sub-feature becomes a thin addition (a fourth task type) rather than new infrastructure.
