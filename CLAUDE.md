# ChurchCore Academy — Agent Reference

This file is the authoritative guide for AI-assisted development in this repository.

## Repo identity

- This repository is the **ChurchCore Academy** codebase.
- ChurchCore Academy is the **SIS and College Management** product in the ChurchCore platform.
- This repository is **not** the LMS and must not contain Moodle runtime code.
- ChurchCore Learning belongs in a separate Moodle fork repository.

## Non-negotiable rules

### Rule 1 — No Moodle in this repo

Do not reintroduce Moodle core, Moodle plugins, or Moodle theme code here.

If a task requires Moodle customization, it belongs in the separate LMS repository.

### Rule 2 — Respect the system boundary

This repo owns:

- SIS and college management
- student records and academic standing
- enrollment, transcripts, graduation, and compliance tracking
- faculty and administrator workflows
- institutional academic workflow orchestration
- LMS launch orchestration from the Academy side when needed

This repo does not own:

- course delivery UI or learning engagement
- Moodle auth internals
- Moodle themes
- Moodle plugins
- Moodle database schema

### Rule 3 — ShepherdAI Academy is not a chatbot

If implementing ShepherdAI in this repository:

- do implement deterministic signal detection, scoring, explainability, workflow recommendation, and optional draft generation
- do not implement a chat window, general assistant, or freeform conversational interface
- do not use or imply access to Ops, Learning, or Care data
- do not let UI components or controllers make hidden AI calls
- keep ShepherdAI product-specific to ChurchCore Academy

Required framing:

**ShepherdAI for ChurchCore Academy is an explainable Academic Workflow recommendation engine, not an AI chatbot. It uses structured SIS and college-management signals from Academy to generate Suggested Academic Workflows for human review and action, with optional LLM assistance limited to wording and administrative support content. It is product-specific and must not use or imply access to Ops, Learning, or Care data.**

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
5. SIS-to-LMS integration points
