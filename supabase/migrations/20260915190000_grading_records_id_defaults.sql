-- The grading-records tables were created without a default on their `id` column, unlike
-- every other text-id table in this schema (see academy_denomination_memberships, which has
-- `id text primary key default gen_random_uuid()::text`). Building write operations for these
-- tables (competency/narrative evaluation framework builder) surfaced the gap: without a
-- server-side default, the API layer would have to require the client to generate and supply
-- a unique id, which no other write path in this codebase does and which is easy to get wrong
-- (e.g. a client that omits the field entirely produces the literal string "undefined" rather
-- than a real error). Adding the default here instead, matching the established pattern, so the
-- id column can simply be omitted from INSERT statements as it is everywhere else.
--
-- Per CLAUDE.md, migrations are append-only — 20260602030000_grading_records.sql is not edited.

alter table academy_evaluation_scales alter column id set default gen_random_uuid()::text;
alter table academy_evaluation_scale_bands alter column id set default gen_random_uuid()::text;
alter table academy_evaluation_rule_sets alter column id set default gen_random_uuid()::text;
alter table academy_official_record_rules alter column id set default gen_random_uuid()::text;
