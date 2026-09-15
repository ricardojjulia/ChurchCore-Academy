-- Add snooze and dismiss note columns to ai_suggestions
alter table ai_suggestions
  add column if not exists dismiss_note text,
  add column if not exists snooze_until timestamptz;
