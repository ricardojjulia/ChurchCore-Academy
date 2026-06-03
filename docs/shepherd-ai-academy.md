# ShepherdAI for ChurchCore Academy

**ShepherdAI for ChurchCore Academy is an explainable Academic Workflow recommendation engine, not an AI chatbot. It uses structured faith-based SIS and education-management signals from Academy to generate Suggested Academic Workflows for human review and action, with optional LLM assistance limited to wording and administrative support content. It is product-specific and must not use or imply access to Ops, Learning, or Care data.**

## Product framing

ChurchCore Academy is the faith-based education management system and SIS in the ChurchCore platform. It handles:

- institutional administration
- Bible school, children's school, seminary, college, and university configuration
- academic years, terms, sessions, cohorts, divisions, departments, and campuses
- enrollment
- academic records
- course catalogs, course types, course durations, sections, credits, clock hours, and prerequisites
- grading scales, grading types, GPA rules, pass/fail rules, competency or narrative grading, and transcript rules
- transcripts
- faculty, teacher, professor, guardian, student, and administrator workflows
- graduation and compliance tracking
- student PWA workflows

ChurchCore Academy is not the LMS.

## Guardrails

- ShepherdAI Academy uses only ChurchCore Academy data and Academy domain logic.
- It must not read from or imply access to Ops, Learning, or Care.
- It must not implement a chat experience, general assistant, or open-ended Q&A workflow.
- Core triggering, scoring, urgency, standing logic, transcript checks, and graduation checks remain deterministic.
- LLM support is optional and limited to wording refinement, message draft generation, and readability support.
- LMS engagement, devotional activity, ministry participation, counseling records, giving records, and inferred spiritual condition are outside ShepherdAI Academy's allowed signal set.

## Data contracts

The current implementation uses typed in-memory models that map to the intended persistence contracts:

### ai_signals

- `id`
- `tenant_id`
- `entity_type`
- `entity_id`
- `signal_type`
- `signal_value`
- `signal_window`
- `signal_payload_json`
- `detected_at`

### ai_suggestions

- `id`
- `tenant_id`
- `product_area`
- `workflow_type`
- `workflow_code`
- `entity_type`
- `entity_id`
- `title`
- `summary`
- `confidence_score`
- `urgency`
- `explanation_json`
- `boundary_note`
- `status`
- `generated_at`

### workflows

- `id`
- `tenant_id`
- `suggestion_id`
- `workflow_type`
- `owner_user_id`
- `assigned_to_user_id`
- `status`
- `due_at`
- `completed_at`
- `created_at`

### workflow_actions

- `id`
- `workflow_id`
- `action_type`
- `action_payload_json`
- `status`
- `created_at`

### workflow_feedback

- `id`
- `workflow_id`
- `user_id`
- `feedback_type`
- `notes`
- `created_at`

## Current implementation modules

- `src/modules/shepherd-ai`
- `src/modules/academic-workflows`
- `src/modules/academy-data`
- `src/modules/scheduled-jobs`

## Current v1 workflow coverage

- incomplete enrollment follow-up
- missing student documentation review
- graduation eligibility review
- academic standing or credit progress review
- transcript or records inconsistency review
- faculty or course assignment imbalance review

## Expansion direction

ShepherdAI Academy should expand only after the core faith-based SIS model is in place. New workflow recommendations should stay deterministic and explainable, including:

- academic calendar setup gaps
- unassigned teacher or professor review
- grading configuration inconsistencies
- student document and guardian record gaps
- transcript readiness and promotion/graduation review
- student PWA action reminders based on Academy-owned requirements
