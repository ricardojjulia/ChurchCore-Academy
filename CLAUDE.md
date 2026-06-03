# ChurchCore Academy — Agent Reference

This file is the authoritative guide for AI-assisted development in this repository.

## Repo identity

- This repository is the **ChurchCore Academy** codebase.
- ChurchCore Academy is the **faith-based education management system and SIS** in the ChurchCore platform.
- It must support Bible schools, children's schools, seminaries, colleges, and universities through configurable academic structures rather than hardcoded college-only assumptions.
- This repository is **not** the LMS and must not contain Moodle runtime code.
- ChurchCore Learning and any LMS runtime belong outside this repository.

## Non-negotiable rules

### Rule 0 — Use the software factory for substantial work

For major features, architecture changes, LMS integration work, student PWA work, grading/transcript work, auth/privacy work, or ShepherdAI expansion, follow `docs/software-factory.md`.

The software factory is tool-agnostic and must remain compatible with Codex, GitHub Copilot, Claude Code, and similar AI coding tools. Do not make essential process depend on one vendor-specific feature.

When the active agent is Codex and Superpowers skills are available, Codex must use the relevant Superpowers skills for the work. This includes `superpowers:using-superpowers` for skill selection, `superpowers:brainstorming` for creative or product-direction work, `superpowers:writing-plans` for multi-step implementation plans, and `superpowers:verification-before-completion` before claiming implementation work is complete.

The expected path is:

1. intake
2. discovery
3. options
4. design spec
5. implementation plan
6. execution
7. verification
8. review
9. delivery

Small documentation and copy edits can be handled directly, but product direction changes must update durable docs.

### Rule 1 — No Moodle in this repo

Do not reintroduce Moodle core, Moodle plugins, or Moodle theme code here.

If a task requires Moodle customization, it belongs in the separate LMS repository.

### Rule 2 — Respect the system boundary

This repo owns:

- faith-based SIS and education management
- institution type configuration
- academic years, terms, sessions, cohorts, calendars, campuses, departments, and divisions
- course catalog, course types, course durations, sections, credits, clock hours, and prerequisites
- grading scales, grading types, GPA rules, pass/fail rules, competency or narrative grading, transcripts, and academic records
- student records and academic standing
- enrollment, transcripts, graduation, and compliance tracking
- faculty, professor, teacher, guardian, student, and administrator workflows
- institutional academic workflow orchestration
- student PWA workflows
- LMS launch orchestration from the Academy side when needed

This repo does not own:

- course delivery UI or learning engagement
- Moodle auth internals
- Moodle themes
- Moodle plugins
- Moodle database schema
- Canvas runtime internals
- LMS course delivery business logic

### Rule 3 — ShepherdAI Academy is not a chatbot

If implementing ShepherdAI in this repository:

- do implement deterministic signal detection, scoring, explainability, workflow recommendation, and optional draft generation
- do not implement a chat window, general assistant, or freeform conversational interface
- do not use or imply access to Ops, Learning, or Care data
- do not let UI components or controllers make hidden AI calls
- keep ShepherdAI product-specific to ChurchCore Academy

Required framing:

**ShepherdAI for ChurchCore Academy is an explainable Academic Workflow recommendation engine, not an AI chatbot. It uses structured faith-based SIS and education-management signals from Academy to generate Suggested Academic Workflows for human review and action, with optional LLM assistance limited to wording and administrative support content. It is product-specific and must not use or imply access to Ops, Learning, or Care data.**

### Rule 4 — Integrate through contracts

Cross-system behavior must go through explicit interfaces such as:

- SSO launch and logout
- roster and enrollment sync
- grade and progress sync
- webhook/event callbacks
- service APIs

Do not implement SIS business logic inside LMS-specific code paths.

### Rule 5 — Start simple

The repo is intentionally minimal right now. Prefer small foundational decisions over premature framework sprawl.

When adding a stack, document:

1. runtime and framework choice
2. deployment target
3. persistence model
4. auth approach
5. institution configuration model
6. SIS-to-LMS integration points
7. student PWA impact
