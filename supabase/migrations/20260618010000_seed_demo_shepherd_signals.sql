-- ==========================================================
-- SEED: ShepherdAI Demo Signals, Suggestions, and Workflow
-- Tenant: cca-main
-- Depends on:
--   20260424010000 — shepherd_ai_academy schema
--   20260616085000 — institution foundation (people, sections)
--   20260616230000 — enrollment data (students, programs)
--
-- Provides baseline ShepherdAI queue rows for the demo tenant
-- so /admin/workflows shows meaningful data on first load.
-- The evaluation job overwrites these on each run using live
-- dataset evaluation (on conflict do update).
-- ==========================================================

-- ── Signals ────────────────────────────────────────────────

insert into public.ai_signals (
  id, tenant_id, product_area, entity_type, entity_id,
  signal_type, signal_value, signal_window, signal_payload_json, detected_at
)
values
  -- Ezra Coleman: newly admitted, enrollment incomplete
  (
    'signal-enrollment-person-ezra-coleman',
    'cca-main', 'academy', 'student', 'person-ezra-coleman',
    'enrollment_pending_beyond_threshold', 21, '21d',
    '{"openDays":21,"missingEnrollmentSteps":["financial_clearance","advisor_assignment"],"advisorAssigned":false,"programAssigned":true}'::jsonb,
    '2026-06-18 09:00:00+00'
  ),

  -- Daniel Hart: missing required documents
  (
    'signal-docs-person-daniel-hart',
    'cca-main', 'academy', 'student', 'person-daniel-hart',
    'required_document_missing', 2, 'current-term',
    '{"missingDocuments":["proof_of_ministry_placement","background_check"],"documentationNotes":"Background check expired; placement letter pending."}'::jsonb,
    '2026-06-18 09:00:00+00'
  ),

  -- Naomi Price: near graduation (BTH year 5, 110/120 credits)
  (
    'signal-graduation-person-naomi-price',
    'cca-main', 'academy', 'student', 'person-naomi-price',
    'graduation_threshold_near', 92, 'degree-audit',
    '{"programName":"Bachelor of Theology","completionRatio":0.917,"creditsEarned":110,"requiredCredits":120,"allProgramCoursesCompleted":false,"graduationAdministrativeHolds":[]}'::jsonb,
    '2026-06-18 09:00:00+00'
  ),

  -- Leah Brooks: credit progress gap (AA-ML, stalled at 52/60)
  (
    'signal-progress-person-leah-brooks',
    'cca-main', 'academy', 'student', 'person-leah-brooks',
    'credit_progress_gap', 8, 'academic-year',
    '{"creditGap":8,"expectedCreditsByNow":60,"creditsEarned":52,"gpa":2.4,"expectedNextTermRegistered":false,"statusFlag":"at_risk"}'::jsonb,
    '2026-06-18 09:00:00+00'
  ),

  -- Ministry Practicum: section missing registered students
  (
    'signal-section-setup-section-ministry-practicum',
    'cca-main', 'academy', 'course_section', 'section-ministry-practicum',
    'faculty_course_assignment_imbalance', 12, 'current-term',
    '{"instructorAssigned":true,"rosterCount":0,"rosterCapacity":12,"setupAlerts":["no_students_registered"]}'::jsonb,
    '2026-06-18 09:00:00+00'
  )
on conflict (id) do update
  set signal_value       = excluded.signal_value,
      signal_payload_json = excluded.signal_payload_json,
      detected_at         = excluded.detected_at;

-- ── Suggestions ────────────────────────────────────────────

insert into public.ai_suggestions (
  id, tenant_id, product_area, workflow_type, workflow_code,
  entity_type, entity_id, title, summary,
  confidence_score, urgency,
  suggested_actions, explanation_json, boundary_note,
  message_draft, status, generated_at
)
values
  (
    'suggestion-signal-enrollment-person-ezra-coleman',
    'cca-main', 'academy', 'academic', 'incomplete_enrollment_follow_up',
    'student', 'person-ezra-coleman',
    'Possible Finding: incomplete enrollment follow-up',
    'Ezra Coleman may require admissions follow-up because enrollment steps appear incomplete or unresolved beyond the configured review window.',
    78, 'high',
    '[{"actionType":"assign_admissions_admin_follow-up","label":"Assign admissions/admin follow-up","description":"Assign admissions/admin follow-up","requiresHumanReview":true},{"actionType":"identify_missing_enrollment_steps","label":"Identify missing enrollment steps","description":"Identify missing enrollment steps","requiresHumanReview":true},{"actionType":"create_reminder_task","label":"Create reminder task","description":"Create reminder task","requiresHumanReview":true}]'::jsonb,
    '{"headline":"Enrollment pending 21+ days with unresolved steps","signals":[{"label":"Days pending","value":21,"weight":"primary"},{"label":"Missing steps","value":2,"weight":"secondary"}],"confidence":"High — multiple unresolved enrollment indicators detected","urgencyRationale":"Enrollment window is approaching; financial clearance and advisor assignment are missing","whyItSurfaced":"The enrollment record shows unresolved steps, missing assignment details, or a pending status beyond the configured threshold."}'::jsonb,
    'This suggestion is based only on Academy enrollment records. It does not assume lack of interest, financial reasons, personal reasons, spiritual condition, or learning engagement.',
    null,
    'suggested',
    '2026-06-18 09:00:00+00'
  ),

  (
    'suggestion-signal-docs-person-daniel-hart',
    'cca-main', 'academy', 'academic', 'missing_documentation_review',
    'student', 'person-daniel-hart',
    'Possible Finding: missing student documentation review',
    'Daniel Hart may require registrar or administrative review because required student documentation appears incomplete.',
    85, 'high',
    '[{"actionType":"notify_registrar_or_administrator","label":"Notify registrar or administrator","description":"Notify registrar or administrator","requiresHumanReview":true},{"actionType":"draft_document_request_message","label":"Draft document request message","description":"Draft document request message","requiresHumanReview":true},{"actionType":"create_student_record_follow-up_task","label":"Create student record follow-up task","description":"Create student record follow-up task","requiresHumanReview":true}]'::jsonb,
    '{"headline":"2 required documents missing from student record","signals":[{"label":"Missing documents","value":2,"weight":"primary"},{"label":"Expired background check","value":1,"weight":"secondary"}],"confidence":"High — specific missing document fields identified","urgencyRationale":"Background check expiry and placement letter affect enrollment standing","whyItSurfaced":"Required documentation fields are missing or pending verification in the Academy record."}'::jsonb,
    'This suggestion is an administrative record-completion review. It should not be framed as student fault or lack of commitment.',
    null,
    'suggested',
    '2026-06-18 09:00:00+00'
  ),

  (
    'suggestion-signal-graduation-person-naomi-price',
    'cca-main', 'academy', 'academic', 'graduation_eligibility_review',
    'student', 'person-naomi-price',
    'Possible Finding: graduation eligibility review',
    'Naomi Price may be ready for registrar review because program completion indicators are approaching graduation thresholds.',
    91, 'medium',
    '[{"actionType":"assign_registrar_review","label":"Assign registrar review","description":"Assign registrar review","requiresHumanReview":true},{"actionType":"verify_completed_credits","label":"Verify completed credits","description":"Verify completed credits","requiresHumanReview":true},{"actionType":"prepare_graduation_eligibility_checklist","label":"Prepare graduation eligibility checklist","description":"Prepare graduation eligibility checklist","requiresHumanReview":true}]'::jsonb,
    '{"headline":"110/120 credits earned — 92% program completion","signals":[{"label":"Credits earned","value":110,"weight":"primary"},{"label":"Completion ratio","value":"91.7%","weight":"primary"},{"label":"Administrative holds","value":0,"weight":"secondary"}],"confidence":"Very high — near-complete degree audit with no holds","urgencyRationale":"Graduation review should begin to allow timely processing","whyItSurfaced":"Credits earned and program completion indicators suggest graduation readiness may warrant review."}'::jsonb,
    'This suggestion does not declare final graduation eligibility. Final approval requires authorized registrar or institutional review.',
    null,
    'open',
    '2026-06-18 09:00:00+00'
  ),

  (
    'suggestion-signal-progress-person-leah-brooks',
    'cca-main', 'academy', 'academic', 'academic_standing_or_credit_progress_review',
    'student', 'person-leah-brooks',
    'Possible Finding: academic standing or credit progress review',
    'Leah Brooks may benefit from advisor review because academic progress appears below the expected milestone or registration continuity is unresolved.',
    72, 'medium',
    '[{"actionType":"assign_advisor_review","label":"Assign advisor review","description":"Assign advisor review","requiresHumanReview":true},{"actionType":"draft_support-oriented_outreach","label":"Draft support-oriented outreach","description":"Draft support-oriented outreach","requiresHumanReview":true},{"actionType":"recommend_academic_planning_meeting","label":"Recommend academic planning meeting","description":"Recommend academic planning meeting","requiresHumanReview":true}]'::jsonb,
    '{"headline":"8-credit gap vs expected pace, GPA 2.4, not registered for next term","signals":[{"label":"Credit gap","value":8,"weight":"primary"},{"label":"GPA","value":2.4,"weight":"secondary"},{"label":"Next term registration","value":"missing","weight":"secondary"}],"confidence":"Moderate — multiple soft indicators align","urgencyRationale":"Risk of falling below satisfactory academic progress threshold","whyItSurfaced":"Program progress, GPA, or expected next-term registration signals suggest a review of academic pacing may be appropriate."}'::jsonb,
    'This suggestion does not infer motivation, ability, spiritual condition, personal challenges, or learning engagement.',
    null,
    'suggested',
    '2026-06-18 09:00:00+00'
  ),

  (
    'suggestion-signal-section-setup-section-ministry-practicum',
    'cca-main', 'academy', 'academic', 'faculty_or_course_assignment_imbalance_review',
    'course_section', 'section-ministry-practicum',
    'Possible Finding: faculty or course assignment imbalance review',
    'Ministry Practicum (MIN-390-A) may require academic administration review because faculty load, roster capacity, or section setup appears out of balance.',
    68, 'medium',
    '[{"actionType":"notify_academic_administrator","label":"Notify academic administrator","description":"Notify academic administrator","requiresHumanReview":true},{"actionType":"create_course_setup_task","label":"Create course setup task","description":"Create course setup task","requiresHumanReview":true},{"actionType":"flag_staffing_imbalance","label":"Flag staffing imbalance","description":"Flag staffing imbalance","requiresHumanReview":true}]'::jsonb,
    '{"headline":"Section open with 0 registered students","signals":[{"label":"Roster count","value":0,"weight":"primary"},{"label":"Setup alerts","value":1,"weight":"secondary"}],"confidence":"Moderate — section is fully staffed but has no enrollment","urgencyRationale":"Field practicum sections require advance placement coordination","whyItSurfaced":"Faculty assignment counts, advisee ratios, roster capacity, or section setup indicators exceeded configured administrative thresholds."}'::jsonb,
    'This suggestion is for administrative planning and should not be framed as faculty performance criticism.',
    null,
    'suggested',
    '2026-06-18 09:00:00+00'
  )
on conflict (id) do update
  set title              = excluded.title,
      summary            = excluded.summary,
      confidence_score   = excluded.confidence_score,
      urgency            = excluded.urgency,
      suggested_actions  = excluded.suggested_actions,
      explanation_json   = excluded.explanation_json,
      boundary_note      = excluded.boundary_note,
      generated_at       = excluded.generated_at;

-- ── Promoted workflow (graduation eligibility review) ──────

insert into public.workflows (
  id, tenant_id, suggestion_id, workflow_type, workflow_code,
  owner_user_id, assigned_to_user_id, status, due_at, completed_at, created_at
)
values
  (
    'workflow-suggestion-signal-graduation-person-naomi-price',
    'cca-main',
    'suggestion-signal-graduation-person-naomi-price',
    'academic',
    'graduation_eligibility_review',
    'person-regina-holt',
    'person-regina-holt',
    'open',
    '2026-07-01 17:00:00+00',
    null,
    '2026-06-18 09:00:00+00'
  )
on conflict (id) do nothing;
