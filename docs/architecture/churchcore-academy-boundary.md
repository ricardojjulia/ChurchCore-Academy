# ChurchCore Academy Product Boundary

ChurchCore Academy is the faith-based education management system and SIS of the ChurchCore platform. It owns academic administration, enrollment, student records, guardians, teachers, professors, transcripts, grading, faculty workflows, academic progress, graduation review, compliance tracking, student PWA workflows, and Academic Workflows.

ChurchCore Academy must support Bible schools, children's schools, seminaries, colleges, and universities through configurable academic structures, including institution type, academic years, terms, sub-divisions, course types, course durations, grading types, faculty/teacher roles, and student lifecycle rules.

ChurchCore Learning, Moodle, Canvas, or any other LMS provider is separate from Academy. Academy must not own LMS activity, lesson progress, course content engagement, assignment submissions, discussions, reflection journals, formation engagement, devotional activity, mentorship based on learning engagement, or learning behavior analytics.

ShepherdAI for ChurchCore Academy is an explainable Academic Workflow recommendation engine, not an AI chatbot. It uses structured faith-based SIS and education-management signals from Academy to generate Suggested Academic Workflows for human review and action, with optional LLM assistance limited to wording and administrative support content. It is product-specific and must not use or imply access to Ops, Learning, or Care data.

ShepherdAI Academy may only use Academy SIS and education-management records. It must not use or imply access to counseling records, treatment plans, ministry participation, church attendance, giving records, devotional activity, spiritual condition, or LMS engagement.

Core workflow detection, scoring, confidence, urgency, academic standing, transcript validation, and graduation eligibility checks must be deterministic. Optional LLM support may only polish explanations, draft editable administrative messages, or improve readability of missing requirement summaries.
