# ChurchCore Academy Software Factory

## Purpose

The ChurchCore Academy software factory is the repeatable operating model for building this product with AI assistance while keeping human control over product direction, architecture, safety, and delivery.

It exists because ChurchCore Academy is not a small prototype. It is a faith-based education management system and SIS with student records, grading, transcripts, guardians, faculty workflows, LMS integrations, and student PWA surfaces. Work on this product must move through clear stages instead of a single long AI chat that plans, builds, tests, and reviews itself.

## Source Model

This factory adapts the model described in Qudrat Ullah's freeCodeCamp article, "How to Build a Software Factory with Claude Code: From Vibe Coding to Agentic Development":

https://www.freecodecamp.org/news/how-to-build-software-factory-with-claude-code/

The article's key idea is that production AI-assisted development needs structure: context, persistent knowledge, focused agents, orchestrated workflows, and delivery gates. ChurchCore Academy applies that idea to this repository using the files, docs, tests, and verification commands available here.

This factory is tool-agnostic. It must work with Codex, GitHub Copilot, Claude Code, and similar AI coding tools. Tool-specific features such as Claude skills, Codex plans, GitHub Copilot chat prompts, subagents, or hooks are optional ways to run the same factory workflow; they are not the factory itself.

## Factory Definition

For ChurchCore Academy, a software factory is:

> A small, repository-owned system of docs, rules, workflows, focused AI roles, verification commands, and review gates that lets one developer and AI collaborators build product features consistently without losing the product vision or damaging production boundaries.

It is not a fully autonomous engineering team. It is a disciplined pipeline that keeps AI work scoped, reviewable, testable, and aligned with the Academy product boundary.

## Supported AI Tools

The factory supports three primary operating modes:

### Codex Mode

Codex should use this repo's docs as durable context, inspect the codebase with shell tools, write or update specs and plans under `docs/superpowers/`, edit files with scoped patches, and run verification commands before delivery.

When Superpowers skills are available in Codex, Codex must use them. The minimum expected mapping is:

- `superpowers:using-superpowers` for skill selection
- `superpowers:brainstorming` for creative, product, UX, architecture, or behavior changes
- `superpowers:writing-plans` for multi-step implementation plans
- `superpowers:test-driven-development` for feature or bugfix implementation when applicable
- `superpowers:systematic-debugging` for bugs or unexpected failures
- `superpowers:verification-before-completion` before claiming implementation completion
- `superpowers:requesting-code-review` for major feature completion or risky changes

Codex maps factory stages as:

- Context: current prompt, repo files, terminal output, memory, and docs
- Knowledge: `CLAUDE.md`, `README.md`, `docs/software-factory.md`, product specs, architecture docs, and plans
- Agents: focused passes, subagents when available, or separate task turns
- Workflow: discovery, design, plan, execution, verification, review, delivery
- Delivery: final summary with tests run, risks, and changed files

### GitHub Copilot Mode

GitHub Copilot should use this factory through repository instructions, chat prompts, pull request review comments, and task-focused edits.

Copilot maps factory stages as:

- Context: selected files, workspace context, open editor state, chat instructions, and PR diff
- Knowledge: repo docs, `CLAUDE.md`, `docs/software-factory.md`, specs, plans, and architecture docs
- Agents: separate Copilot Chat conversations or focused prompts for product, backend, frontend, test, and review work
- Workflow: ask for codebase discovery first, request options, approve an approach, then request scoped edits
- Delivery: PR description, review checklist, test evidence, and CI results

### Claude Code Mode

Claude Code may use its native `CLAUDE.md`, skills, subagents, hooks, and plan mode to run the same pipeline.

Claude-specific features should be treated as accelerators. The canonical factory rules remain the repository docs and verification gates.

## Tool Compatibility Rules

1. Do not encode essential process only in one AI vendor's feature.
2. Keep factory definitions in markdown files committed to this repository.
3. Prefer plain commands that work from a terminal: `npm test`, `npm run lint`, and `npm run build`.
4. Keep role definitions understandable without specialized agent tooling.
5. When an AI tool lacks subagents, run roles as separate focused passes.
6. When an AI tool lacks hooks, run the documented verification commands manually or through CI.
7. When an AI tool lacks persistent memory, start from `docs/software-factory.md`, `CLAUDE.md`, and the relevant spec or plan.
8. Delivery summaries must be readable by humans and reusable in GitHub pull requests.

## The Five Layers

### 1. Context Layer

The context layer is the live task information available during the current session.

Required behavior:

- inspect the repo before building
- read the relevant docs before editing
- identify product boundaries before proposing code
- summarize the files likely to change
- avoid broad implementation from vague prompts

For ChurchCore Academy, every feature starts by checking whether it touches:

- faith-based SIS core
- institution configuration
- academic calendar
- course catalog
- grading and transcripts
- people and roles
- student PWA
- ShepherdAI Academy
- LMS provider contracts

### 2. Knowledge Layer

The knowledge layer is the durable repository memory that every future task inherits.

Authoritative knowledge files:

- `CLAUDE.md`
- `README.md`
- `docs/product/faith-based-academy-master-plan.md`
- `docs/product/factory-roadmap.md`
- `docs/superpowers/specs/2026-06-01-institution-type-operating-rules-design.md`
- `docs/superpowers/specs/2026-06-01-faith-based-academy-platform-design.md`
- `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`
- `docs/superpowers/plans/2026-06-01-phase-1-sprint-1-institution-type-operating-rules.md`
- `docs/superpowers/plans/2026-06-01-phase-1-sprint-2-institution-config-types-defaults-validation.md`
- `docs/superpowers/plans/2026-06-01-phase-1-sprint-3-institution-config-migration-seed.md`
- `docs/superpowers/plans/2026-06-01-phase-1-sprint-4-institution-config-repository-api.md`
- `docs/architecture.md`
- `docs/architecture/churchcore-academy-boundary.md`
- `docs/shepherd-ai-academy.md`
- `docs/lms-dual-provider-strategy.md`
- `docs/software-factory.md`
- `docs/adr/README.md`
- `docs/adr/0002-institution-type-and-operating-rules-model.md`
- `docs/reviews/reviewer-procedure.md`
- `docs/agents/product-opportunity-scout.md`

Rules:

- update durable docs when product direction changes
- keep LMS runtime code outside this repo
- preserve ShepherdAI Academy as an explainable workflow recommendation engine
- keep Academy as the system of record
- prefer provider-neutral contracts over provider-specific business logic

### 3. Agent Layer

The agent layer splits work into focused roles. These roles may be implemented as Codex subagents, GitHub Copilot focused chats, Claude Code subagents, separate sessions, or disciplined task passes.

ChurchCore Academy factory roles:

1. Product Researcher
   - clarifies institution needs, user roles, product rules, and success criteria

2. Domain Architect
   - protects Academy boundaries and maps work to the correct domain module

3. Data Modeler
   - designs tenant-aware records, migrations, relationships, and constraints

4. Backend Builder
   - implements services, repositories, API routes, jobs, and integration contracts

5. Frontend And PWA Builder
   - implements admin screens, student PWA surfaces, responsive UI, and accessibility

6. LMS Integration Builder
   - implements provider-neutral contracts and Moodle, Canvas, or no-LMS adapters

7. ShepherdAI Workflow Builder
   - implements deterministic signals, scoring, recommendations, explanations, and guardrails

8. Test Verifier
   - writes and runs focused tests, lint, build, browser checks, and regression checks

9. Security And Privacy Reviewer
   - checks student data boundaries, auth, role access, auditability, and high-risk integrations

10. Release Validator
   - verifies the final diff, docs, tests, and delivery notes before handoff

Each role should work from the same product boundary docs, but with a narrow responsibility.

### 4. Workflow Layer

The workflow layer is the orchestrated path from idea to verified change.

Default factory workflow:

1. Intake
   - capture the user request and determine the affected product area

2. Discovery
   - inspect files, docs, tests, and current behavior

3. Options
   - compare 2-3 feasible approaches for substantial product or architecture work

4. Design Spec
   - write or update a spec in `docs/superpowers/specs/`

5. Implementation Plan
   - write or update a plan in `docs/superpowers/plans/`

6. Execution
   - make scoped changes task-by-task

7. Verification
   - run relevant tests, lint, build, and browser checks when UI is involved

8. Review
   - inspect the diff for product boundary, security, data, and regression risks

9. Delivery
   - summarize changes, verification, remaining risks, and next steps

## Delivery Layer

The delivery layer prevents unfinished or unsafe changes from being presented as complete.

Required local checks for most changes:

```bash
npm test
npm run lint
npm run build
```

Additional checks when relevant:

- browser verification for UI and PWA work
- database migration and seed verification for schema work
- API route checks for backend workflows
- provider contract tests for LMS work
- role and data-boundary tests for student, guardian, faculty, and admin features
- security review for auth, student records, LMS sync, and ShepherdAI signal handling

## Feature Factory Template

Use this template for major features:

```markdown
## Factory Intake

Feature:
Product area:
Primary users:
Institution modes affected:
Data touched:
LMS provider impact:
Student PWA impact:
ShepherdAI impact:
Auth and privacy risks:

## Discovery Notes

Relevant docs:
Relevant files:
Current behavior:
Known constraints:

## Design Decision

Chosen approach:
Alternatives rejected:
Reason:

## Verification Plan

Tests:
Lint:
Build:
Browser checks:
Security/privacy review:
```

## Factory Rules For This Product

1. Academy is the system of record.
2. Moodle and Canvas are providers, not product cores.
3. No LMS runtime code belongs in this repository.
4. ShepherdAI Academy is not a chatbot.
5. Student records, grades, transcripts, guardian relationships, and LMS sync are high-sensitivity areas.
6. Major features need specs and plans before implementation.
7. Tests must scale with risk.
8. UI work must be verified visually when possible.
9. Delivery summaries must state what was verified and what remains risky.
10. Product direction changes must update durable docs, not only code.

## Current Factory State

The factory currently has:

- product boundary docs
- master product plan
- platform design spec
- implementation master plan
- LMS provider strategy
- one-week sprint roadmap
- ADR procedure
- reviewer procedure
- Product Opportunity Scout agent definition
- test, lint, and build commands
- approved production MVP remediation design
- Release 1 implementation plan and security ADRs
- auth and tenant-access operations runbook
- verification evidence that distinguishes implemented, verified, planned, and externally blocked work
- ShepherdAI guardrail docs and tests

The next maturity step is to add actual domain-specific implementation plans for institution configuration, academic calendar, course catalog, grading, student PWA, LMS contracts, Moodle adapter, Canvas adapter, and ShepherdAI expansion.

## GitHub Pull Request Checklist

Use this checklist in GitHub PRs, regardless of whether the work was produced with Codex, Copilot, Claude Code, or manual edits:

```markdown
## Software Factory Review

- [ ] Product area is identified.
- [ ] Change respects the Academy/LMS boundary.
- [ ] Student, guardian, grade, transcript, and LMS sync data risks are addressed.
- [ ] ShepherdAI remains deterministic, explainable, and non-chatbot where relevant.
- [ ] Tests were added or intentionally not needed.
- [ ] `npm test` passed.
- [ ] `npm run lint` passed.
- [ ] `npm run build` passed.
- [ ] UI or PWA changes were visually checked.
- [ ] Docs were updated for product direction, architecture, or operations changes.
```
