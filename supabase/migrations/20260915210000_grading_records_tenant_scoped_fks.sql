-- The new write paths for grading configuration (competency/narrative evaluation framework
-- builder) never verified that a scale/course/section id supplied by the caller actually
-- belongs to the caller's own tenant — the existing single-column foreign keys only prove the
-- id exists somewhere, not that it's the caller's. A caller who knows (or guesses) another
-- tenant's scale/course/section id could create a band or rule set in their own tenant that
-- points at another tenant's configuration. Found via code review before merge.
--
-- Fixed the same way the alumni/giving PR fixed the identical class of bug (see
-- 20260915180000_alumni_crm_id_type_fix.sql): replace the single-column FKs with composite
-- (tenant_id, id) foreign keys, matching the established pattern from
-- 20260613142628_admissions_applications.sql. academy_courses and academy_course_sections
-- already have a (tenant_id, id) unique index; academy_evaluation_scales does not yet, so one
-- is added here first.

create unique index if not exists academy_evaluation_scales_tenant_id_idx
  on public.academy_evaluation_scales (tenant_id, id);

alter table academy_evaluation_scale_bands drop constraint if exists academy_evaluation_scale_bands_scale_id_fkey;
alter table academy_evaluation_scale_bands
  add constraint academy_evaluation_scale_bands_tenant_scale_fkey
    foreign key (tenant_id, scale_id) references academy_evaluation_scales (tenant_id, id) on delete cascade;

alter table academy_evaluation_rule_sets drop constraint if exists academy_evaluation_rule_sets_course_id_fkey;
alter table academy_evaluation_rule_sets drop constraint if exists academy_evaluation_rule_sets_section_id_fkey;
alter table academy_evaluation_rule_sets drop constraint if exists academy_evaluation_rule_sets_scale_id_fkey;
alter table academy_evaluation_rule_sets
  add constraint academy_evaluation_rule_sets_tenant_course_fkey
    foreign key (tenant_id, course_id) references academy_courses (tenant_id, id) on delete cascade,
  add constraint academy_evaluation_rule_sets_tenant_section_fkey
    foreign key (tenant_id, section_id) references academy_course_sections (tenant_id, id) on delete cascade,
  add constraint academy_evaluation_rule_sets_tenant_scale_fkey
    foreign key (tenant_id, scale_id) references academy_evaluation_scales (tenant_id, id) on delete restrict;
