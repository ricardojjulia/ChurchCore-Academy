---
name: feature-factory
description: Use this skill when the user asks to build, ship, or implement a ChurchCore Academy feature end to end. Runs the full chain of seven agents with human approval points after the story and the brief, builds backend then frontend, verifies with acceptance tests, then validates. Triggers on: "build a feature", "ship a feature", "run the factory", "feature factory", "implement end to end".
---

## Overview

This skill orchestrates seven agents to ship a feature end-to-end for ChurchCore Academy.
Three human approval points keep you in control of what matters.

**Chain order:**
```
codebase-researcher → story-writer → [APPROVE STORY] → spec-writer → [APPROVE BRIEF] →
backend-builder → frontend-builder → test-verifier → implementation-validator → [APPROVE PR]
```

---

## Step 1 — Map the codebase

Invoke **codebase-researcher** with the feature idea and the relevant area of code.

Pass: the rough feature description.
Wait for: relevant files, patterns, risks, and a high-level approach.

---

## Step 2 — Write the user story

Invoke **story-writer** with:
- the rough feature description
- the codebase-researcher's findings

Wait for: user story, acceptance criteria, edge cases, out-of-scope items.

---

## Step 3 — Human approval: story

Show the story to the user. Ask:

> "Does this story match what you want?
> Reply **approved** to continue, describe what to change, or **reject** to stop."

- **Approved** → continue to Step 4.
- **Changes requested** → re-invoke story-writer with the user's feedback. Repeat until approved or rejected.
- **Rejected** → stop the chain. Summarise what was explored so the user can decide next steps.

---

## Step 4 — Write the technical brief

Invoke **spec-writer** with:
- the approved user story
- the codebase-researcher's findings

Wait for: data model changes, flow, API, frontend, tests, risks, files affected.

---

## Step 5 — Human approval: brief

Show the brief to the user. Ask:

> "Any design red flags or missing constraints?
> Reply **approved** to continue, describe what to change, or **reject** to stop."

- **Approved** → continue to Step 6.
- **Changes requested** → re-invoke spec-writer with feedback. Repeat until approved or rejected.
- **Rejected** → stop. Keep the approved story so the user can resume later with a different approach.

---

## Step 6 — Build the backend

Invoke **backend-builder** with:
- the approved technical brief
- the codebase-researcher's findings

Wait for: backend implementation summary (files changed, API contract, patterns used, test results).

---

## Step 7 — Build the frontend

Invoke **frontend-builder** with:
- the approved technical brief
- the codebase-researcher's findings
- the backend-builder's summary (API contract)

Wait for: frontend implementation summary (files changed, components used, test results).

---

## Step 8 — Write acceptance tests

Invoke **test-verifier** with:
- the approved user story (with acceptance criteria)
- the approved technical brief
- both builder summaries

Wait for: acceptance test file, coverage report, any criteria that failed or need clarification.

---

## Step 9 — Validate the implementation

Invoke **implementation-validator** with:
- the approved user story
- the approved technical brief
- the test-verifier's report

Wait for: findings grouped by Critical / Important / Minor / Recommended next agent.

---

## Step 10 — Fix critical findings (if any)

If the validator reports **Critical** findings:
- Route to **backend-builder** or **frontend-builder** with the specific finding and the failing test.
- After fixes, re-invoke **test-verifier** with the updated summaries.
- Re-invoke **implementation-validator**.
- Repeat until no Critical findings remain.

---

## Step 11 — Human approval: PR

Show the validator's final report to the user. Ask:

> "Validation complete. Ready to open the PR?"

If yes: create the PR with:
- Branch: `feature/<phase>-<short-name>`
- Title: concise description
- Body: what changed, why, tests added, ADR reference if applicable
- Checklist: `npm test` ✓, `npm run lint` ✓, `npm run build` ✓

---

## Hard rules

- Never skip a human approval point.
- Never invoke frontend-builder before backend-builder has finished.
- Never invoke test-verifier before both builders have finished.
- Never invoke implementation-validator before test-verifier has run.
- If any agent reports it cannot complete its task, stop and surface the reason.
- Each agent runs in its own focused context. Pass only the inputs that agent needs.
