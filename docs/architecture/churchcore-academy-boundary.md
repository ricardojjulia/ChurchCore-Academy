# ChurchCore Academy Product Boundary

ChurchCore Academy is the SIS and college-management system of the ChurchCore platform. It owns academic administration, enrollment, student records, transcripts, faculty workflows, academic progress, graduation review, compliance tracking, and Academic Workflows.

ChurchCore Learning is a separate standalone LMS. Academy must not own LMS activity, lesson progress, course content engagement, assignment submissions, discussions, reflection journals, formation engagement, devotional activity, mentorship based on learning engagement, or learning behavior analytics.

ShepherdAI for ChurchCore Academy is an explainable Academic Workflow recommendation engine, not an AI chatbot. It uses structured SIS and college-management signals from Academy to generate Suggested Academic Workflows for human review and action, with optional LLM assistance limited to wording and administrative support content. It is product-specific and must not use or imply access to Ops, Learning, or Care data.

ShepherdAI Academy may only use Academy SIS and college-management records. It must not use or imply access to counseling records, treatment plans, ministry participation, church attendance, giving records, devotional activity, spiritual condition, or LMS engagement.

Core workflow detection, scoring, confidence, urgency, academic standing, transcript validation, and graduation eligibility checks must be deterministic. Optional LLM support may only polish explanations, draft editable administrative messages, or improve readability of missing requirement summaries.

